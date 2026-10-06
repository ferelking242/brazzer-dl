import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { DownloadJob, JobStatus } from "../src/shared/types";
import { jobsRepository, storageDirectory } from "./database";
import { assertSafeRedirect, MAX_FILE_BYTES, resolveMediaUrl, validateMediaUrl } from "./security";

const MAX_ACTIVE_OR_QUEUED = 50;
const MAX_REDIRECTS = 4;

function safeFileName(url: URL): string {
  let name = path.basename(url.pathname);
  try {
    name = decodeURIComponent(name);
  } catch {
    // Keep the original encoded name if a server uses malformed escaping.
  }
  name = name
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);
  return name || `video${path.extname(url.pathname) || ".mp4"}`;
}

function readableError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Download stopped.";
    return error.message.slice(0, 240);
  }
  return "Download failed.";
}

async function fetchWithSafeRedirects(
  url: URL,
  originalHost: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const resolved = await resolveMediaUrl(current.toString());
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = httpsRequest(
        resolved.url,
        {
          method: "GET",
          headers,
          signal,
          lookup: (_hostname, _options, callback) => {
            const address = resolved.addresses[0];
            callback(null, address.address, address.family);
          },
        },
        resolve,
      );
      req.once("error", reject);
      req.end();
    });
    const status = response.statusCode ?? 0;
    if (![301, 302, 303, 307, 308].includes(status)) return response;

    const locationHeader = response.headers.location;
    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
    response.destroy();
    if (!location || attempt === MAX_REDIRECTS) {
      throw new Error("Le serveur vidéo a renvoyé trop de redirections ou une adresse invalide.");
    }
    const next = new URL(location, current);
    current = assertSafeRedirect(originalHost, next);
  }
  throw new Error("Le serveur vidéo a renvoyé trop de redirections.");
}

export class DownloadManager {
  private workerRunning = false;
  private readonly controllers = new Map<string, AbortController>();

  start(): void {
    void this.pump();
  }

  async enqueue(rawUrl: string): Promise<DownloadJob> {
    const url = await validateMediaUrl(rawUrl);
    const outstanding = jobsRepository
      .list()
      .filter((job) => job.status === "queued" || job.status === "downloading").length;
    if (outstanding >= MAX_ACTIVE_OR_QUEUED) {
      throw new Error(`La file est limitée à ${MAX_ACTIVE_OR_QUEUED} téléchargements en cours ou en attente.`);
    }
    const job = jobsRepository.create({
      id: randomUUID(),
      url: url.toString(),
      fileName: safeFileName(url),
      sourceHost: url.hostname,
    });
    this.start();
    return job;
  }

  pause(id: string): DownloadJob | null {
    const job = jobsRepository.get(id);
    if (!job || (job.status !== "queued" && job.status !== "downloading")) return job;
    const updated = jobsRepository.update(id, {
      status: "paused",
      speedBytesPerSecond: 0,
      error: null,
    });
    this.controllers.get(id)?.abort();
    return updated;
  }

  resume(id: string): DownloadJob | null {
    const job = jobsRepository.get(id);
    if (!job || (job.status !== "paused" && job.status !== "failed")) return job;
    const updated = jobsRepository.update(id, {
      status: "queued",
      speedBytesPerSecond: 0,
      error: null,
    });
    this.start();
    return updated;
  }

  cancel(id: string): DownloadJob | null {
    const job = jobsRepository.get(id);
    if (!job || job.status === "completed" || job.status === "cancelled") return job;
    const updated = jobsRepository.update(id, {
      status: "cancelled",
      speedBytesPerSecond: 0,
      error: null,
    });
    this.controllers.get(id)?.abort();
    if (job.status !== "downloading") {
      void rm(this.partialPath(id), { force: true });
    }
    return updated;
  }

  async remove(id: string): Promise<DownloadJob | null> {
    const job = jobsRepository.get(id);
    if (!job || job.status === "downloading" || job.status === "queued") return null;
    await rm(this.partialPath(id), { force: true });
    await rm(this.completePath(job), { force: true });
    return jobsRepository.remove(id);
  }

  private partialPath(id: string): string {
    return path.join(storageDirectory, `${id}.part`);
  }

  private completePath(job: DownloadJob): string {
    return path.join(storageDirectory, `${job.id}-${job.fileName}`);
  }

  private async pump(): Promise<void> {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      while (true) {
        const job = jobsRepository.nextQueued();
        if (!job) break;
        await this.download(job);
      }
    } finally {
      this.workerRunning = false;
      if (jobsRepository.hasQueued()) void this.pump();
    }
  }

  private async download(job: DownloadJob): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    jobsRepository.update(job.id, { status: "downloading", error: null, speedBytesPerSecond: 0 });
    const partialPath = this.partialPath(job.id);
    let downloadedBytes = 0;

    try {
      await mkdir(storageDirectory, { recursive: true });
      try {
        downloadedBytes = (await stat(partialPath)).size;
      } catch {
        downloadedBytes = 0;
      }
      if (downloadedBytes > MAX_FILE_BYTES) {
        throw new Error("Le fichier partiel dépasse la limite de 5 Go par fichier.");
      }

      const requestUrl = new URL(job.url);
      const headers: Record<string, string> = {
        accept: "video/*,application/octet-stream;q=0.9",
        "accept-encoding": "identity",
      };
      if (downloadedBytes > 0) headers.range = `bytes=${downloadedBytes}-`;

      const response = await fetchWithSafeRedirects(
        requestUrl,
        requestUrl.hostname,
        headers,
        controller.signal,
      );

      const responseStatus = response.statusCode ?? 0;
      if (responseStatus !== 200 && responseStatus !== 206) {
        response.destroy();
        if (responseStatus === 401 || responseStatus === 403) {
          throw new Error("Ce lien exige une authentification, qui n’est pas prise en charge.");
        }
        throw new Error(`Le serveur vidéo a renvoyé l’erreur HTTP ${responseStatus}.`);
      }

      const contentTypeHeader = response.headers["content-type"];
      const contentType = (Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!(contentType.startsWith("video/") || contentType === "application/octet-stream" || contentType === "application/x-matroska")) {
        response.destroy();
        throw new Error("Cette adresse ne renvoie pas directement un fichier vidéo.");
      }

      const isPartialResponse = responseStatus === 206;
      if (isPartialResponse) {
        const contentRangeHeader = response.headers["content-range"];
        const contentRange = Array.isArray(contentRangeHeader) ? contentRangeHeader[0] : contentRangeHeader ?? "";
        const match = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/i);
        if (!match || Number(match[1]) !== downloadedBytes) {
          response.destroy();
          throw new Error("Le serveur a renvoyé une réponse de reprise invalide.");
        }
      } else {
        downloadedBytes = 0;
      }

      const contentLengthHeader = response.headers["content-length"];
      const contentLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
      const remainingBytes = contentLength ? Number(contentLength) : null;
      const contentRangeHeader = response.headers["content-range"];
      const contentRange = Array.isArray(contentRangeHeader) ? contentRangeHeader[0] : contentRangeHeader;
      const contentRangeTotal = contentRange?.split("/")[1];
      const totalBytes =
        contentRangeTotal && contentRangeTotal !== "*"
          ? Number(contentRangeTotal)
          : remainingBytes !== null && Number.isFinite(remainingBytes)
            ? downloadedBytes + remainingBytes
            : null;
      if (totalBytes !== null && totalBytes > MAX_FILE_BYTES) {
        response.destroy();
        throw new Error("La limite de 5 Go par fichier est dépassée.");
      }

      jobsRepository.update(job.id, {
        downloadedBytes,
        totalBytes,
        speedBytesPerSecond: 0,
      });

      const startedAt = Date.now();
      let lastUpdateAt = startedAt;
      let lastUpdateBytes = downloadedBytes;
      const progress = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_FILE_BYTES) {
            callback(new Error("La limite de 5 Go par fichier est dépassée."));
            return;
          }
          const now = Date.now();
          if (now - lastUpdateAt >= 500) {
            const speed = Math.max(0, Math.round(((downloadedBytes - lastUpdateBytes) * 1000) / (now - lastUpdateAt)));
            jobsRepository.update(job.id, {
              downloadedBytes,
              totalBytes,
              speedBytesPerSecond: speed,
            });
            lastUpdateAt = now;
            lastUpdateBytes = downloadedBytes;
          }
          callback(null, chunk);
        },
      });
      const mode = isPartialResponse ? "a" : "w";
      await pipeline(
        response,
        progress,
        createWriteStream(partialPath, { flags: mode }),
        { signal: controller.signal },
      );

      const current = jobsRepository.get(job.id);
      if (!current || current.status !== "downloading") return;
      if (totalBytes !== null && downloadedBytes !== totalBytes) {
        throw new Error("Le téléchargement s’est terminé avant la taille de fichier annoncée.");
      }

      const completedPath = this.completePath(job);
      await rename(partialPath, completedPath);
      jobsRepository.update(job.id, {
        status: "completed",
        downloadedBytes,
        totalBytes: totalBytes ?? downloadedBytes,
        speedBytesPerSecond: 0,
        error: null,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      const current = jobsRepository.get(job.id);
      if (current?.status === "cancelled") {
        await rm(partialPath, { force: true });
      } else if (current?.status === "paused" || controller.signal.aborted) {
        jobsRepository.update(job.id, { status: "paused", downloadedBytes, speedBytesPerSecond: 0 });
      } else {
        const message = readableError(error);
        jobsRepository.update(job.id, {
          status: "failed",
          downloadedBytes,
          speedBytesPerSecond: 0,
          error: message,
        });
      }
    } finally {
      this.controllers.delete(job.id);
    }
  }
}

export const downloadManager = new DownloadManager();

export function isTerminalStatus(status: JobStatus): boolean {
  return status === "completed" || status === "cancelled";
}
