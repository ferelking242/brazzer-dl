import { createDecipheriv } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { assertStreamSegmentUrl, publicLookup, resolveStreamUrl, validateStreamUrlShape } from "./security";

const MAX_REDIRECTS = 4;
const MAX_SEGMENT_BYTES = 512 * 1024 * 1024;
const SEGMENT_CONCURRENCY = 5;
const SEGMENT_RETRIES = 3;
const MAX_SEGMENTS = 20_000;

export interface HlsProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  totalDurationSeconds?: number | null;
}

interface Variant {
  url: URL;
  bandwidth: number | null;
  resolution: string | null;
}

export interface SegmentKey {
  method: "AES-128";
  url: URL;
  iv: Buffer | null;
}

export interface Segment {
  url: URL;
  duration: number | null;
  key: SegmentKey | null;
  sequence: number;
}

export interface MediaPlaylist {
  segments: Segment[];
  byteLength: number;
}

function parseAttributes(line: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const source = line.slice(line.indexOf(":") + 1);
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const value = match[2].replace(/^"|"$/g, "");
    attributes.set(match[1], value);
  }
  return attributes;
}

async function fetchText(url: URL, signal: AbortSignal): Promise<string> {
  const response = await fetchFollowingRedirects(url, signal, "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*");
  try {
    if (response.statusCode !== 200) {
      throw new Error(`Le flux a renvoyé l’erreur HTTP ${response.statusCode ?? 0}.`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    response.destroy();
  }
}

async function fetchFollowingRedirects(
  url: URL,
  signal: AbortSignal,
  accept: string,
): Promise<IncomingMessage> {
  let current = validateStreamUrlShape(url.toString());
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const resolved = await resolveStreamUrl(current.toString());
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = httpsRequest(
        resolved.url,
        {
          method: "GET",
          headers: { accept, "accept-encoding": "identity" },
          signal,
          lookup: publicLookup(resolved.addresses),
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
      throw new Error("Le flux a renvoyé trop de redirections.");
    }
    const next = new URL(location, current);
    if (next.hostname.toLowerCase() !== current.hostname.toLowerCase()) {
      throw new Error("Le flux redirige vers un autre hôte, ce qui n’est pas pris en charge.");
    }
    current = validateStreamUrlShape(next.toString());
  }
  throw new Error("Le flux a renvoyé trop de redirections.");
}

export function isMasterPlaylist(text: string): boolean {
  return text.includes("#EXT-X-STREAM-INF");
}

export function selectVariant(master: string, base: URL): Variant {
  const lines = master.split(/\r?\n/);
  const variants: Variant[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const attributes = parseAttributes(line);
    const uri = lines.slice(index + 1).find((candidate) => candidate.trim() && !candidate.trim().startsWith("#"))?.trim();
    if (!uri) continue;
    const bandwidth = attributes.get("BANDWIDTH") ?? attributes.get("AVERAGE-BANDWIDTH");
    variants.push({
      url: assertStreamSegmentUrl(new URL(uri, base).toString(), base.hostname),
      bandwidth: bandwidth ? Number(bandwidth) : null,
      resolution: attributes.get("RESOLUTION") ?? null,
    });
  }
  if (variants.length === 0) throw new Error("Le flux ne contient aucune variante lisible.");
  return variants.reduce((best, candidate) =>
    (candidate.bandwidth ?? 0) > (best.bandwidth ?? 0) ? candidate : best,
  );
}

function parseIv(value: string | undefined): Buffer | null {
  if (!value) return null;
  const hex = value.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length > 32) return null;
  return Buffer.from(hex.padStart(32, "0"), "hex");
}

export function parseMediaPlaylist(text: string, base: URL): MediaPlaylist {
  const lines = text.split(/\r?\n/);
  const segments: Segment[] = [];
  let pendingDuration: number | null = null;
  let pendingKey: SegmentKey | null = null;
  let sequence = 0;

  const sequenceMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
  if (sequenceMatch) sequence = Number(sequenceMatch[1]);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-KEY")) {
      const attributes = parseAttributes(line);
      const method = attributes.get("METHOD");
      const uri = attributes.get("URI");
      if (method === "AES-128" && uri) {
        pendingKey = {
          method: "AES-128",
          url: assertStreamSegmentUrl(new URL(uri, base).toString(), base.hostname),
          iv: parseIv(attributes.get("IV")),
        };
      } else if (method === "NONE") {
        pendingKey = null;
      } else if (method && method !== "AES-128") {
        throw new Error(`Le chiffrement ${method} du flux n’est pas pris en charge.`);
      }
      continue;
    }
    if (line.startsWith("#EXTINF")) {
      const value = Number(line.slice(line.indexOf(":") + 1).split(",")[0]);
      pendingDuration = Number.isFinite(value) ? value : null;
      continue;
    }
    if (line.startsWith("#")) continue;
    segments.push({
      url: assertStreamSegmentUrl(new URL(line, base).toString(), base.hostname),
      duration: pendingDuration,
      key: pendingKey,
      sequence: sequence + segments.length,
    });
    pendingDuration = null;
  }

  if (segments.length === 0) throw new Error("Le flux ne contient aucun segment.");
  if (segments.length > MAX_SEGMENTS) throw new Error("Le flux contient trop de segments.");
  const byteLength = segments.reduce((sum, segment) => sum + (segment.duration ?? 0), 0);
  return { segments, byteLength };
}

export function segmentIv(segment: Segment): Buffer | null {
  if (!segment.key) return null;
  return segment.key.iv ?? ivFromSequence(segment.sequence);
}

function ivFromSequence(sequence: number): Buffer {
  const iv = Buffer.alloc(16);
  iv.writeUInt32BE(sequence >>> 0, 12);
  return iv;
}

async function fetchKey(url: URL, signal: AbortSignal): Promise<Buffer> {
  const response = await fetchFollowingRedirects(url, signal, "application/octet-stream");
  try {
    if (response.statusCode !== 200) {
      throw new Error(`La clé de déchiffrement est introuvable (HTTP ${response.statusCode ?? 0}).`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk as Buffer);
    const key = Buffer.concat(chunks);
    if (key.length !== 16) throw new Error("La clé de déchiffrement est invalide.");
    return key;
  } finally {
    response.destroy();
  }
}

async function downloadSegment(segment: Segment, destination: string, signal: AbortSignal): Promise<number> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SEGMENT_RETRIES; attempt += 1) {
    try {
      const response = await fetchFollowingRedirects(segment.url, signal, "video/*,application/octet-stream,*/*");
      if (response.statusCode !== 200) {
        response.destroy();
        throw new Error(`Le segment a renvoyé l’erreur HTTP ${response.statusCode ?? 0}.`);
      }
      let bytes = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > MAX_SEGMENT_BYTES) {
            callback(new Error("Un segment dépasse la taille maximale autorisée."));
            return;
          }
          callback(null, chunk);
        },
      });
      const sink = createWriteStream(destination);
      if (segment.key) {
        const key = await fetchKey(segment.key.url, signal);
        const iv = segmentIv(segment);
        if (!iv) throw new Error("L’IV du segment est introuvable.");
        const decipher = createDecipheriv("aes-128-cbc", key, iv);
        await pipeline(response, counter, decipher, sink, { signal });
      } else {
        await pipeline(response, counter, sink, { signal });
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      if (attempt < SEGMENT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Le téléchargement d’un segment a échoué.");
}

async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

export interface HlsDownloadResult {
  outputPath: string;
  bytes: number;
}

export async function downloadHlsToMp4(options: {
  manifestUrl: string;
  workDirectory: string;
  outputPath: string;
  signal: AbortSignal;
  onProgress: (progress: HlsProgress) => void;
  ffmpegPath?: string;
}): Promise<HlsDownloadResult> {
  const { manifestUrl, workDirectory, outputPath, signal, onProgress } = options;
  await mkdir(workDirectory, { recursive: true });

  const manifest = validateStreamUrlShape(manifestUrl);
  const manifestText = await fetchText(manifest, signal);

  let mediaUrl = manifest;
  let mediaText = manifestText;
  if (isMasterPlaylist(manifestText)) {
    const variant = selectVariant(manifestText, manifest);
    mediaUrl = variant.url;
    mediaText = await fetchText(variant.url, signal);
  }
  if (isMasterPlaylist(mediaText)) {
    const variant = selectVariant(mediaText, mediaUrl);
    mediaUrl = variant.url;
    mediaText = await fetchText(variant.url, signal);
  }

  const { segments, byteLength } = parseMediaPlaylist(mediaText, mediaUrl);
  const totalDuration = byteLength > 0 ? byteLength : null;

  let downloadedBytes = 0;
  let completedDuration = 0;
  const startedAt = Date.now();
  let lastReportAt = startedAt;
  let lastReportBytes = 0;
  const segmentPaths: string[] = [];

  const estimateTotalBytes = (): number | null => {
    if (!totalDuration || completedDuration <= 0) return null;
    const estimate = Math.round((downloadedBytes / completedDuration) * totalDuration);
    return Math.max(estimate, downloadedBytes);
  };

  await runPool(segments, SEGMENT_CONCURRENCY, async (segment, index) => {
    const segmentPath = path.join(workDirectory, `segment-${String(index).padStart(6, "0")}.ts`);
    const bytes = await downloadSegment(segment, segmentPath, signal);
    segmentPaths[index] = segmentPath;
    downloadedBytes += bytes;
    completedDuration += segment.duration ?? 0;
    const now = Date.now();
    if (now - lastReportAt >= 500) {
      const speed = Math.max(0, Math.round(((downloadedBytes - lastReportBytes) * 1000) / (now - lastReportAt)));
      onProgress({
        downloadedBytes,
        totalBytes: estimateTotalBytes(),
        speedBytesPerSecond: speed,
        totalDurationSeconds: totalDuration,
      });
      lastReportAt = now;
      lastReportBytes = downloadedBytes;
    }
  });

  const concatPath = path.join(workDirectory, "segments.txt");
  const concatBody = segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(concatPath, `${concatBody}\n`, "utf8");

  await remuxWithFfmpeg(concatPath, outputPath, options.ffmpegPath ?? "ffmpeg", signal);
  onProgress({
    downloadedBytes,
    totalBytes: estimateTotalBytes(),
    speedBytesPerSecond: 0,
    totalDurationSeconds: totalDuration,
  });

  await rm(workDirectory, { recursive: true, force: true });
  return { outputPath, bytes: downloadedBytes };
}

async function remuxWithFfmpeg(
  concatPath: string,
  outputPath: string,
  ffmpegPath: string,
  signal: AbortSignal,
): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        "-movflags",
        "+faststart",
        // The output file carries a ".part" suffix while it is being written,
        // so the container format must be stated explicitly.
        "-f",
        "mp4",
        outputPath,
      ],
      { signal },
    );
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => reject(error));
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`L’assemblage MP4 a échoué (code ${code ?? "inconnu"}). ${stderr.slice(0, 200)}`.trim()));
    });
  });
}
