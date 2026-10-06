import { jobsRepository } from "./database";
import { createApp } from "./app";
import { downloadManager } from "./download-manager";

async function main() {
  jobsRepository.recoverInterrupted();
  const app = await createApp();
  const production = process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT ?? (production ? 5000 : process.env.API_PORT ?? 3001));
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
