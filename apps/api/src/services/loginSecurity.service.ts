import type { Request } from "express";
import {
  sendFailedLoginWarningEmail,
  sendLoginAlertEmail,
  type SignInContext,
} from "./securityEmail.service.js";

/** Failures on one account before the owner is warned by email. */
const WARN_AFTER_ATTEMPTS = 3;
/** How long failures keep accumulating without another failure. */
const ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
/** Minimum spacing between warning emails, so a burst sends one message. */
const WARNING_COOLDOWN_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  expiresAt: number;
  lastWarnedAt: number;
}

// In-memory, matching the rate-limit middleware. Counts reset on deploy, which
// is acceptable: this drives a courtesy email, not an access decision. The
// per-email rate limit on /auth/login is what actually caps guessing.
const attempts = new Map<number, AttemptRecord>();
let recordsSinceSweep = 0;

function sweep(now: number) {
  recordsSinceSweep += 1;
  if (recordsSinceSweep < 500 && attempts.size < 10_000) return;
  recordsSinceSweep = 0;
  for (const [userId, record] of attempts) {
    if (record.expiresAt <= now) attempts.delete(userId);
  }
}

/**
 * Best-effort client address and device for a request.
 *
 * `x-forwarded-for` is trusted first because the API sits behind a proxy in
 * production. It is client-supplied and therefore spoofable — fine for an
 * informational email, never for an authorization decision.
 */
export function describeRequest(req: Request): SignInContext {
  const forwarded = req.headers["x-forwarded-for"];
  const firstHop = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  const userAgent = req.headers["user-agent"];

  return {
    ip: firstHop || req.ip || req.socket.remoteAddress || "unknown",
    userAgent:
      typeof userAgent === "string" ? userAgent.slice(0, 200) : undefined,
    at: new Date(),
  };
}

type AccountRef = { id: number; email: string; firstName: string | null };

/**
 * Records one failed sign-in attempt and warns the owner once the run crosses
 * the threshold. Never throws or blocks — a failed send must not change what
 * the caller reports to the client.
 */
export function recordFailedAttempt(
  user: AccountRef,
  stage: "password" | "code",
  context: SignInContext
) {
  const now = Date.now();
  sweep(now);

  const existing = attempts.get(user.id);
  const record: AttemptRecord =
    existing && existing.expiresAt > now
      ? existing
      : { count: 0, expiresAt: 0, lastWarnedAt: 0 };

  record.count += 1;
  record.expiresAt = now + ATTEMPT_WINDOW_MS;
  attempts.set(user.id, record);

  const dueForWarning =
    record.count >= WARN_AFTER_ATTEMPTS &&
    now - record.lastWarnedAt >= WARNING_COOLDOWN_MS;
  if (!dueForWarning) return;

  record.lastWarnedAt = now;
  void sendFailedLoginWarningEmail({
    to: user.email,
    firstName: user.firstName,
    attempts: record.count,
    stage,
    context,
  }).catch(error => {
    console.error("Failed-login warning email not delivered", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown Resend error",
    });
  });
}

/** Clears the run of failures once the account authenticates successfully. */
export function clearFailedAttempts(userId: number) {
  attempts.delete(userId);
}

/** Tells the owner a session started. Fire-and-forget, like the warning. */
export function notifySuccessfulLogin(
  user: AccountRef,
  context: SignInContext
) {
  void sendLoginAlertEmail({
    to: user.email,
    firstName: user.firstName,
    context,
  }).catch(error => {
    console.error("Login alert email not delivered", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown Resend error",
    });
  });
}
