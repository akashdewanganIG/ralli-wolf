import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Compatibility shim for a platform start command that points straight at this
 * file. The wake-up itself now lives in instrumentation.ts so it runs on any
 * server start, whatever launched it — this only spawns Next and forwards
 * signals.
 */
function startWebServer() {
  const require = createRequire(import.meta.url);
  const nextCli = require.resolve("next/dist/bin/next");
  const webDirectory = fileURLToPath(new URL("..", import.meta.url));
  const child = spawn(process.execPath, [nextCli, "start"], {
    cwd: webDirectory,
    env: process.env,
    stdio: "inherit",
  });
  let stopping = false;

  const stop = signal => {
    if (stopping) return;
    stopping = true;
    if (!child.killed) child.kill(signal);
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  child.once("error", error => {
    console.error(
      JSON.stringify({
        event: "web_server_start_failed",
        error: error.message,
      })
    );
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    if (code !== null) process.exitCode = code;
    else if (!stopping && signal) process.exitCode = 1;
  });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (entrypoint === import.meta.url) startWebServer();
