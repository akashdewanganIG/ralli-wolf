import { renderEmail, type EmailRow } from "./emailTemplate.js";
import { sendResendEmail } from "./resendClient.js";

export interface SignInContext {
  /** Best-effort client address; see `describeRequest` in login.security.ts. */
  ip: string;
  userAgent?: string;
  at: Date;
}

function formatTimestamp(at: Date) {
  // Indian operations team, so report in IST rather than the server's zone.
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(at);
}

function contextRows(context: SignInContext): EmailRow[] {
  const rows: EmailRow[] = [
    { label: "When", value: `${formatTimestamp(context.at)} IST` },
    { label: "IP address", value: context.ip },
  ];
  if (context.userAgent) {
    rows.push({ label: "Device", value: context.userAgent });
  }
  return rows;
}

/**
 * Confirms a completed sign-in to the account owner.
 *
 * Sent after the second factor passes, so it always describes a session that
 * actually started.
 *
 * The shell has a single accent, so the eyebrow is what separates a routine
 * notice like this one from the warning below at a glance.
 */
export async function sendLoginAlertEmail(input: {
  to: string;
  firstName: string | null;
  context: SignInContext;
}) {
  const name = input.firstName?.trim() || "there";
  const rows = contextRows(input.context);

  const html = renderEmail({
    preview: `Signed in from ${input.context.ip}`,
    eyebrow: "Account activity",
    heading: "New sign-in to your account",
    paragraphs: [
      `Hi ${name}, your Ralli Wolf account was just signed in to. If this was you, no action is needed.`,
      "If you do not recognise this sign-in, change your password immediately and contact your administrator.",
    ],
    rowsLabel: "Session details",
    rows,
    footer:
      "You receive this message whenever a session is started on your account.",
    date: input.context.at,
  });

  const text = [
    `Hi ${name},`,
    "",
    "Your Ralli Wolf account was just signed in to.",
    ...rows.map(row => `${row.label}: ${row.value}`),
    "",
    "If this was not you, change your password immediately and contact your administrator.",
    "Ralli Wolf Operations",
  ].join("\n");

  return sendResendEmail({
    to: input.to,
    subject: "New sign-in to your Ralli Wolf account",
    html,
    text,
    category: "login_alert",
  });
}

/**
 * Warns the account owner about repeated failed sign-in attempts.
 *
 * Deliberately says nothing about whether the attempts were close to correct.
 */
export async function sendFailedLoginWarningEmail(input: {
  to: string;
  firstName: string | null;
  attempts: number;
  /** What was being guessed — shapes the advice, not the disclosure. */
  stage: "password" | "code";
  context: SignInContext;
}) {
  const name = input.firstName?.trim() || "there";
  const what =
    input.stage === "password"
      ? "an incorrect password"
      : "an incorrect verification code";

  const rows: EmailRow[] = [
    { label: "Failed attempts", value: String(input.attempts) },
    ...contextRows(input.context),
  ];

  const advice =
    input.stage === "password"
      ? "If this was not you, change your password now. Your account is safe unless someone also has access to your email inbox."
      : "If this was not you, someone may know your password. Change it immediately and contact your administrator.";

  const html = renderEmail({
    preview: `${input.attempts} failed attempts from ${input.context.ip}`,
    eyebrow: "Security alert",
    heading: "Someone tried to sign in to your account",
    paragraphs: [
      `Hi ${name}, there have been ${input.attempts} recent attempts to sign in to your Ralli Wolf account using ${what}. No session was started.`,
      advice,
    ],
    rowsLabel: "Attempt details",
    rows,
    footer:
      "You receive this message when repeated sign-in attempts fail on your account.",
    date: input.context.at,
  });

  const text = [
    `Hi ${name},`,
    "",
    `There have been ${input.attempts} recent attempts to sign in to your Ralli Wolf account using ${what}. No session was started.`,
    ...rows.map(row => `${row.label}: ${row.value}`),
    "",
    advice,
    "Ralli Wolf Operations",
  ].join("\n");

  return sendResendEmail({
    to: input.to,
    subject: "Failed sign-in attempts on your Ralli Wolf account",
    html,
    text,
    category: "login_warning",
  });
}

/** How the password came to be changed, which decides the advice given. */
export type PasswordChangeReason = "reset" | "changed" | "enabled";

const CHANGE_COPY: Record<
  PasswordChangeReason,
  { eyebrow: string; heading: string; opening: string }
> = {
  reset: {
    eyebrow: "Account security",
    heading: "Your password was reset",
    opening:
      "your password has been reset using a code sent to this address, and the old one no longer works.",
  },
  changed: {
    eyebrow: "Account security",
    heading: "Your password was changed",
    opening:
      "your password has just been changed, and the old one no longer works.",
  },
  enabled: {
    eyebrow: "Account security",
    heading: "Password sign-in was turned on",
    opening:
      "a password has been set on your account, so signing in now starts with it.",
  },
};

/**
 * Tells the account owner their password changed.
 *
 * This is the control that makes a stolen reset code survivable: whoever holds
 * the account may not have noticed the change, and this is the message that
 * tells them. It is therefore sent on every path that writes a password —
 * a reset, a deliberate change, and turning password sign-in back on — rather
 * than only the one that felt security-related when it was written.
 *
 * It never contains the password, and it does not link to a reset: an email
 * that arrives unexpectedly should not also hand over a one-click way in.
 */
export async function sendPasswordChangedEmail(input: {
  to: string;
  firstName: string | null;
  reason: PasswordChangeReason;
  context: SignInContext;
}) {
  const name = input.firstName?.trim() || "there";
  const copy = CHANGE_COPY[input.reason];
  const rows = contextRows(input.context);
  const advice =
    "If this was not you, your account may be compromised. Contact your administrator straight away — they can reset your access.";

  const html = renderEmail({
    preview: `${copy.heading}.`,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    paragraphs: [`Hi ${name}, ${copy.opening}`, advice],
    rowsLabel: "Change details",
    rows,
    footer:
      "You receive this message whenever the password on your account changes.",
    date: input.context.at,
  });

  const text = [
    `Hi ${name},`,
    "",
    `${copy.heading}: ${copy.opening}`,
    ...rows.map(row => `${row.label}: ${row.value}`),
    "",
    advice,
    "Ralli Wolf Operations",
  ].join("\n");

  return sendResendEmail({
    to: input.to,
    subject: `${copy.heading} — Ralli Wolf`,
    html,
    text,
    category: "password_changed",
  });
}

/**
 * Tells the account owner a sign-in method was turned on or off.
 *
 * Without this, someone who reaches an open session can quietly remove the
 * second factor and leave no trace the owner would ever see. The audit log
 * records it, but the owner does not read the audit log.
 */
export async function sendAuthMethodChangedEmail(input: {
  to: string;
  firstName: string | null;
  /** Human label, e.g. "Email code" or "Authenticator app". */
  method: string;
  action: "enabled" | "disabled";
  /** Methods still able to sign in, so the owner can judge the risk. */
  remaining: string[];
  context: SignInContext;
}) {
  const name = input.firstName?.trim() || "there";
  const turned = input.action === "enabled" ? "turned on" : "turned off";
  const rows: EmailRow[] = [
    { label: "Method", value: input.method },
    { label: "Change", value: turned },
    {
      label: "Still active",
      value: input.remaining.length ? input.remaining.join(", ") : "none",
    },
    ...contextRows(input.context),
  ];

  const advice =
    input.action === "disabled"
      ? "If you did not turn this off, someone may have access to your account. Contact your administrator straight away."
      : "If you did not turn this on, contact your administrator straight away.";

  const html = renderEmail({
    preview: `${input.method} was ${turned} on your account.`,
    eyebrow: "Account security",
    heading: `A sign-in method was ${turned}`,
    paragraphs: [
      `Hi ${name}, ${input.method.toLowerCase()} has been ${turned} on your Ralli Wolf account.`,
      advice,
    ],
    rowsLabel: "Change details",
    rows,
    footer:
      "You receive this message whenever the ways of signing in to your account change.",
    date: input.context.at,
  });

  const text = [
    `Hi ${name},`,
    "",
    `${input.method} has been ${turned} on your Ralli Wolf account.`,
    ...rows.map(row => `${row.label}: ${row.value}`),
    "",
    advice,
    "Ralli Wolf Operations",
  ].join("\n");

  return sendResendEmail({
    to: input.to,
    subject: `${input.method} was ${turned} — Ralli Wolf`,
    html,
    text,
    category: "auth_method_changed",
  });
}
