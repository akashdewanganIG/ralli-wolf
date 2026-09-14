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

function directApiOrigin(): string | null {
  const exposedOrigin = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (exposedOrigin) return exposedOrigin.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(config.apiUrl)) return config.apiUrl;
  return null;
}

export function manualApiWakeUrl(): string {
  const origin = directApiOrigin();
  return origin ? `${origin}/` : "/api/health";
}

function triggerDirectWakeup(): void {
  const origin = directApiOrigin();
  if (!origin) return;

  const wakeUrl = new URL("/health", origin);
  wakeUrl.searchParams.set("wake", Date.now().toString());

  // This deliberately bypasses the same-origin proxy. Render can answer proxy-
  // originated requests with `hibernate-rate-limited`, while a request from
  // the user's browser starts the free API service. `no-cors` keeps the wake-up
  // effective even while Render's temporary response lacks CORS headers.
  void fetch(wakeUrl, {
    cache: "no-store",
    mode: "no-cors",
  }).catch(() => undefined);
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
  triggerDirectWakeup();

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

export function ensureApiReady({
  force = false,
}: { force?: boolean } = {}): Promise<void> {
  if (!force && Date.now() < readyUntil) return Promise.resolve();
  if (readinessPromise) return readinessPromise;

  readyUntil = 0;
  readinessPromise = pollUntilReady().finally(() => {
    readinessPromise = null;
  });
  return readinessPromise;
}
