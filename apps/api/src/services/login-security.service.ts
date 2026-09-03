import type { Request } from "express";
import {
  sendAuthMethodChangedEmail,
  sendFailedLoginWarningEmail,
  sendLoginAlertEmail,
  sendPasswordChangedEmail,
  type PasswordChangeReason,
  type SignInContext,
} from "./security-email.service.js";
import { logError, logInfo } from "../utils/logger.js";

const WARN_AFTER_ATTEMPTS = 3;

const ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

const WARNING_COOLDOWN_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  expiresAt: number;
  lastWarnedAt: number;
}

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
  dispatch(
    "Failed-login warning",
    user.id,
    sendFailedLoginWarningEmail({
      to: user.email,
      firstName: user.firstName,
      attempts: record.count,
      stage,
      context,
    })
  );
}

export function clearFailedAttempts(userId: number) {
  attempts.delete(userId);
}

function dispatch(
  what: string,
  userId: number,
  send: Promise<{ id: string }>
): void {
  void send
    .then(({ id }) =>
      logInfo("security_email_dispatched", {
        notificationKind: what,
        userId,
        messageId: id,
      })
    )
    .catch(error =>
      logError("security_email_delivery_failed", error, {
        notificationKind: what,
        userId,
      })
    );
}

export function notifySuccessfulLogin(
  user: AccountRef,
  context: SignInContext
) {
  dispatch(
    "Login alert",
    user.id,
    sendLoginAlertEmail({
      to: user.email,
      firstName: user.firstName,
      context,
    })
  );
}

export function notifyPasswordChanged(
  user: AccountRef,
  reason: PasswordChangeReason,
  context: SignInContext
) {
  dispatch(
    "Password change notice",
    user.id,
    sendPasswordChangedEmail({
      to: user.email,
      firstName: user.firstName,
      reason,
      context,
    })
  );
}

export function notifyAuthMethodChanged(
  user: AccountRef,
  method: string,
  action: "enabled" | "disabled",
  remaining: string[],
  context: SignInContext
) {
  dispatch(
    "Auth method change notice",
    user.id,
    sendAuthMethodChangedEmail({
      to: user.email,
      firstName: user.firstName,
      method,
      action,
      remaining,
      context,
    })
  );
}
