export type ApiWakeStatus = "ready" | "timed-out" | "aborted" | "disabled";

export interface ApiWakeResult {
  status: ApiWakeStatus;
  attempts: number;
}

export interface ApiWakeOptions {
  target?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  pollMs?: number;
  fetchImpl?: typeof fetch;
}

export interface KeepApiWarmResult {
  status: "stopped" | "disabled";
  cycles: number;
}

export function apiHealthUrl(rawTarget?: string): URL | null;

export function wakeApi(options?: ApiWakeOptions): Promise<ApiWakeResult>;

export function keepApiWarm(
  options?: ApiWakeOptions & {
    intervalMs?: number;
    onResult?: (result: ApiWakeResult) => void;
  }
): Promise<KeepApiWarmResult>;
