const API_WAKE_TIMEOUT_MS = 90_000;
// A hibernating host holds the connection open for the whole cold start, so the
// probe has to outlive it — a shorter abort kills the request that does the
// waking and the poll never sees the API come back.
const API_WAKE_REQUEST_TIMEOUT_MS = 45_000;
const API_WAKE_POLL_MS = 3_000;
// The host hibernates after ~15 minutes idle, so warm it well inside that.
const API_KEEPALIVE_INTERVAL_MS = 10 * 60_000;

/**
 * An abortable sleep built on the global timer rather than
 * `node:timers/promises`.
 *
 * Next compiles `instrumentation.ts` for every runtime it supports, so the
 * dynamic import of this module is bundled for the non-Node layers too even
 * though `register()` returns early there. Webpack cannot resolve a `node:`
 * URI in those layers and the build fails with UnhandledSchemeError, so this
 * module must stay free of node-scheme imports. `setTimeout` and
 * `AbortSignal` exist in every runtime this can land in.
 */
function delay(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted"));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(undefined);
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

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
    await delay(Math.min(pollMs, remainingAfterRequest), { signal }).catch(
      () => undefined
    );
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
    await delay(intervalMs, { signal }).catch(() => undefined);
    if (signal.aborted) break;

    cycles += 1;
    const result = await wakeApi({ target, signal, ...wakeOptions });
    onResult?.(result);
  }

  return { status: "stopped", cycles };
}
