import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import type { DownloadJob } from "../src/shared/types";
import { jobsRepository, storageDirectory } from "./database";
import { downloadManager } from "./download-manager";

const CreateJobBody = z.object({
  url: z.string().min(1).max(2048),
});

const IdParams = z.object({
  id: z.string().uuid(),
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "La requête a échoué.";
}

function toPublicJob(job: DownloadJob): DownloadJob {
  return {
    ...job,
    // The URL is persisted for resumable downloads but is not needed by the UI.
    url: "",
  };
}

export async function createApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 8 * 1024,
    requestTimeout: 15_000,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "https://ferelking242.github.io,http://localhost:5000,http://127.0.0.1:5000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    global: false,
    max: 600,
    timeWindow: "1 minute",
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "video-manager",
    siteIntegration: "not-connected",
    downloadMode: "public-direct-links-only",
  }));

  app.get("/api/jobs", async () => jobsRepository.list().map(toPublicJob));
  app.get("/api/stats", async () => jobsRepository.stats());

  app.post(
    "/api/jobs",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = CreateJobBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Saisissez un seul lien direct vers un fichier vidéo." });
      }
      try {
        const job = await downloadManager.enqueue(parsed.data.url);
        return reply.code(201).send(toPublicJob(job));
      } catch (error) {
        return reply.code(400).send({ error: errorMessage(error) });
      }
    },
  );

  const updateJob = async (
    request: { params: unknown },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    action: "pause" | "resume" | "cancel",
  ) => {
    const parsed = IdParams.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Identifiant de téléchargement invalide." });
    const job =
      action === "pause"
        ? downloadManager.pause(parsed.data.id)
        : action === "resume"
          ? downloadManager.resume(parsed.data.id)
          : downloadManager.cancel(parsed.data.id);
    if (!job) return reply.code(404).send({ error: "Téléchargement introuvable." });
    return reply.code(200).send(toPublicJob(job));
  };

  const actionLimit = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };
  app.post("/api/jobs/:id/pause", actionLimit, (request, reply) => updateJob(request, reply, "pause"));
  app.post("/api/jobs/:id/resume", actionLimit, (request, reply) => updateJob(request, reply, "resume"));
  app.post("/api/jobs/:id/cancel", actionLimit, (request, reply) => updateJob(request, reply, "cancel"));

  app.delete(
    "/api/jobs/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = IdParams.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "Identifiant de téléchargement invalide." });
      const job = await downloadManager.remove(parsed.data.id);
      if (!job) {
        return reply.code(409).send({ error: "Mettez ce téléchargement en pause ou terminez-le avant de le retirer." });
      }
      return reply.code(204).send();
    }
  );

  app.get("/api/jobs/:id/file", async (request, reply) => {
    const parsed = IdParams.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Identifiant de téléchargement invalide." });
    const job = jobsRepository.get(parsed.data.id);
    if (!job || job.status !== "completed") {
      return reply.code(404).send({ error: "Vidéo terminée introuvable." });
    }
    const filePath = path.join(storageDirectory, `${job.id}-${job.fileName}`);
    try {
      const fileInfo = await stat(filePath);
      reply
        .header("content-type", "application/octet-stream")
        .header("content-length", fileInfo.size)
        .header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(job.fileName)}`)
        .header("cache-control", "private, no-store");
      return reply.send(createReadStream(filePath));
    } catch {
      return reply.code(404).send({ error: "Le fichier vidéo enregistré est introuvable." });
    }
  });

  if (process.env.NODE_ENV === "production") {
    const root = path.resolve("dist");
    await app.register(fastifyStatic, {
      root,
      prefix: "/",
      wildcard: false,
      decorateReply: false,
    });
    app.get("/", async (_request, reply) => reply.sendFile("index.html", root));
  }

  return app;
}
