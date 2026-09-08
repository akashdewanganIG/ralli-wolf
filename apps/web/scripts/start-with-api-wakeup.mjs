import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const API_WAKE_TIMEOUT_MS = 90_000;
// A hibernating host holds the connection open for the whole cold start, so the
// probe has to outlive it — a shorter abort kills the request that does the
// waking and the poll never sees the API come back.
const API_WAKE_REQUEST_TIMEOUT_MS = 45_000;
const API_WAKE_POLL_MS = 3_000;
// The host hibernates after ~15 minutes idle, so warm it well inside that.
const API_KEEPALIVE_INTERVAL_MS = 10 * 60_000;

export function apiHealthUrl(rawTarget = process.env.API_PROXY_TARGET) {
  const value = rawTarget?.trim();
  if (!value) return null;

  const target = new URL(value);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("API_PROXY_TARGET must use HTTP or HTTPS");
  }
  target.pathname = "/health";
  target.search = "";
  target.hash = "";
  return target;
}

export async function wakeApi({
  target = process.env.API_PROXY_TARGET,
  signal = new AbortController().signal,
  timeoutMs = API_WAKE_TIMEOUT_MS,
  requestTimeoutMs = API_WAKE_REQUEST_TIMEOUT_MS,
  pollMs = API_WAKE_POLL_MS,
  fetchImpl = fetch,
} = {}) {
  const healthUrl = apiHealthUrl(target);
  if (!healthUrl) return { status: "disabled", attempts: 0 };

  const deadline = Date.now() + timeoutMs;
  let attempts = 0;

  while (!signal.aborted) {
    const remainingBeforeRequest = deadline - Date.now();
    if (remainingBeforeRequest <= 0) break;

    attempts += 1;
    const requestSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(
        Math.max(1, Math.min(requestTimeoutMs, remainingBeforeRequest))
      ),
    ]);
    const response = await fetchImpl(healthUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: requestSignal,
    }).catch(() => null);
    const ready = response?.ok === true;
    if (response) await response.body?.cancel().catch(() => undefined);
    if (ready) return { status: "ready", attempts };

    const remainingAfterRequest = deadline - Date.now();
    if (remainingAfterRequest <= 0) break;
    await delay(Math.min(pollMs, remainingAfterRequest), undefined, {
      signal,
    }).catch(() => undefined);
  }

  return { status: signal.aborted ? "aborted" : "timed-out", attempts };
}

/**
 * The boot-time wake only covers "both services asleep, web woke first". The
 * API hibernates on its own idle timer, so once this process has been up a
 * while it is the only thing left that can keep the API reachable — without
 * this, a user arriving at an awake web app still meets a sleeping API.
 *
 * Each cycle reuses wakeApi: a healthy API answers the first probe and costs
 * one request, a sleeping one gets the full wake loop.
 */
export async function keepApiWarm({
  target = process.env.API_PROXY_TARGET,
  signal = new AbortController().signal,
  intervalMs = API_KEEPALIVE_INTERVAL_MS,
  onResult,
  ...wakeOptions
} = {}) {
  if (!apiHealthUrl(target)) return { status: "disabled", cycles: 0 };

  let cycles = 0;
  while (!signal.aborted) {
    await delay(intervalMs, undefined, { signal }).catch(() => undefined);
    if (signal.aborted) break;

    cycles += 1;
    const result = await wakeApi({ target, signal, ...wakeOptions });
    onResult?.(result);
  }

  return { status: "stopped", cycles };
}

function startWebServer() {
  const require = createRequire(import.meta.url);
  const nextCli = require.resolve("next/dist/bin/next");
  const webDirectory = fileURLToPath(new URL("..", import.meta.url));
  const child = spawn(process.execPath, [nextCli, "start"], {
    cwd: webDirectory,
    env: process.env,
    stdio: "inherit",
  });
  const wakeController = new AbortController();
  let stopping = false;

  void wakeApi({ signal: wakeController.signal })
    .then(result => {
      if (result.status === "ready") {
        console.info(
          JSON.stringify({
            event: "api_wakeup_ready",
            attempts: result.attempts,
          })
        );
      } else if (result.status === "timed-out") {
        console.warn(
          JSON.stringify({
            event: "api_wakeup_timed_out",
            attempts: result.attempts,
          })
        );
      }

      // Quiet in the steady state: a warm API answers on the first attempt and
      // logs nothing, so anything printed here means it had actually gone away.
      return keepApiWarm({
        signal: wakeController.signal,
        onResult: cycle => {
          if (cycle.status === "timed-out") {
            console.warn(
              JSON.stringify({
                event: "api_keepalive_timed_out",
                attempts: cycle.attempts,
              })
            );
          } else if (cycle.status === "ready" && cycle.attempts > 1) {
            console.info(
              JSON.stringify({
                event: "api_keepalive_rewoke",
                attempts: cycle.attempts,
              })
            );
          }
        },
      });
    })
    .catch(error => {
      console.error(
        JSON.stringify({
          event: "api_wakeup_failed",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });

  const stop = signal => {
    if (stopping) return;
    stopping = true;
    wakeController.abort();
    if (!child.killed) child.kill(signal);
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  child.once("error", error => {
    wakeController.abort();
    console.error(
      JSON.stringify({
        event: "web_server_start_failed",
        error: error.message,
      })
    );
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    wakeController.abort();
    if (code !== null) process.exitCode = code;
    else if (!stopping && signal) process.exitCode = 1;
  });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (entrypoint === import.meta.url) startWebServer();
