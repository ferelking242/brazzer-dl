import { spawn } from "node:child_process";

const npmBin = process.platform === "win32" ? ".cmd" : "";
const children = [
  spawn(`node_modules/.bin/tsx${npmBin}`, ["watch", "server/index.ts"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: { ...process.env, API_PORT: "3001", NODE_ENV: "development" },
  }),
  spawn(`node_modules/.bin/vite${npmBin}`, ["--host", "0.0.0.0", "--port", "5000", "--strictPort"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: { ...process.env, NODE_ENV: "development" },
  }),
];

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (process.platform !== "win32") {
        process.kill(-child.pid, "SIGTERM");
      } else if (!child.killed) {
        child.kill("SIGTERM");
      }
    } catch (error) {
      if (error?.code !== "ESRCH") {
        console.error("Failed to stop application process:", error);
      }
    }
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
