import { jobsRepository } from "./database";
import { createApp } from "./app";
import { downloadManager } from "./download-manager";

async function main() {
  jobsRepository.recoverInterrupted();
  const app = await createApp();
  const production = process.env.NODE_ENV === "production";
  // In dev, Vite listens on PORT (preview port) and proxies /api to API_PORT.
  // In production, Fastify serves everything itself on PORT.
  const port = production
    ? Number(process.env.PORT ?? 5000)
    : Number(process.env.API_PORT ?? 3001);
  await app.listen({
    port,
    host: production ? "0.0.0.0" : "127.0.0.1",
  });
  downloadManager.start();
}

main().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
