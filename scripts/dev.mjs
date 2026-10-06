import { spawn } from "node:child_process";

const npmBin = process.platform === "win32" ? ".cmd" : "";
const children = [
  spawn(`node_modules/.bin/tsx${npmBin}`, ["watch", "server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, API_PORT: "3001", NODE_ENV: "development" },
  }),
  spawn(`node_modules/.bin/vite${npmBin}`, ["--host", "0.0.0.0", "--port", "5000", "--strictPort"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
];

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exitCode = code;
};

for (const child of children) {
  child.on("error", (error) => {
    console.error("Failed to start application process:", error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!shuttingDown) stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
