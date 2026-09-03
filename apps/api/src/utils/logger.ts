type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY =
  /authorization|cookie|password|secret|token|otp|api.?key|email|phone|address|body|payload|headers|url/i;

function redactText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d[\s().-]?){10,15}\b/g, "[REDACTED_NUMBER]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 256);
}

function safeValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 2) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => safeValue(item, key, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([childKey, childValue]) => [
          childKey,
          safeValue(childValue, childKey, depth + 1),
        ])
    );
  }
  return String(value);
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: "UnknownError" };
  const candidate = error as Error & { code?: unknown; status?: unknown };
  return {
    type: error.name || "Error",
    ...(typeof candidate.code === "string" || typeof candidate.code === "number"
      ? { code: candidate.code }
      : {}),
    ...(typeof candidate.status === "number"
      ? { status: candidate.status }
      : {}),
  };
}

function write(
  level: LogLevel,
  event: string,
  context?: Record<string, unknown>
): void {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event: redactText(event),
    ...(context ? { context: safeValue(context) } : {}),
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function logInfo(
  event: string,
  context?: Record<string, unknown>
): void {
  write("info", event, context);
}

export function logWarn(
  event: string,
  context?: Record<string, unknown>
): void {
  write("warn", event, context);
}

export function logError(
  event: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  write("error", event, { ...context, error: errorDetails(error) });
}
