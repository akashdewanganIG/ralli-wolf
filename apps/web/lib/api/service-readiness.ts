"use client";

import { config } from "../config";

const API_READY_CACHE_MS = 30_000;
const API_WAKE_TIMEOUT_MS = 2 * 60_000;
const API_WAKE_REQUEST_TIMEOUT_MS = 75_000;
const API_WAKE_POLL_MS = 2_500;

let readyUntil = 0;
let readinessPromise: Promise<void> | null = null;

export class ApiReadinessError extends Error {
  readonly code = "API_NOT_READY";

  constructor() {
    super("The API did not become ready in time");
    this.name = "ApiReadinessError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function probeApi(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const healthUrl = new URL(
    `${config.apiUrl}/api/health`,
    window.location.origin
  );
  healthUrl.searchParams.set("wake", Date.now().toString());

  try {
    const response = await fetch(healthUrl, {
      credentials: "include",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const health = (await response.json().catch(() => null)) as {
      status?: unknown;
      database?: unknown;
    } | null;
    return health?.status === "ok" && health.database === "connected";
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function pollUntilReady(): Promise<void> {
  const deadline = Date.now() + API_WAKE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const remainingBeforeRequest = deadline - Date.now();
    const requestTimeout = Math.max(
      1,
      Math.min(API_WAKE_REQUEST_TIMEOUT_MS, remainingBeforeRequest)
    );

    if (await probeApi(requestTimeout)) {
      readyUntil = Date.now() + API_READY_CACHE_MS;
      return;
    }

    const remainingAfterRequest = deadline - Date.now();
    if (remainingAfterRequest <= 0) break;
    await delay(Math.min(API_WAKE_POLL_MS, remainingAfterRequest));
  }

  throw new ApiReadinessError();
}

export function ensureApiReady(): Promise<void> {
  if (Date.now() < readyUntil) return Promise.resolve();
  if (readinessPromise) return readinessPromise;

  readinessPromise = pollUntilReady().finally(() => {
    readinessPromise = null;
  });
  return readinessPromise;
}
