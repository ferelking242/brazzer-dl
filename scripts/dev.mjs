// Single-process launcher: build the frontend once, then serve the API and the
// built UI from the same Fastify process on the preview-injected port.
import { spawnSync } from "node:child_process";

const npmBin = process.platform === "win32" ? ".cmd" : "";

const stepsDone = spawnSync(`node_modules/.bin/vite${npmBin}`, ["build"], {
  stdio: "inherit",
});
if (stepsDone.status !== 0) {
  console.error("Frontend build failed, stopping.");
  process.exit(stepsDone.status ?? 1);
}

const port = process.env.PORT ?? "5000";
const api = spawnSync(`node_modules/.bin/tsx${npmBin}`, ["server/index.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    // Keep the API-host flag aligned with the injected port.
    API_PORT: port,
  },
});
process.exitCode = api.status ?? 1;
