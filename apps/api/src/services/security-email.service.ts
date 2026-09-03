import { renderEmail, type EmailRow } from "./email-template.js";
import { sendResendEmail } from "./resend-client.js";

export interface SignInContext {
  ip: string;
  userAgent?: string;
  at: Date;
}

function formatTimestamp(at: Date) {
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

export async function sendFailedLoginWarningEmail(input: {
  to: string;
  firstName: string | null;
  attempts: number;

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

export async function sendAuthMethodChangedEmail(input: {
  to: string;
  firstName: string | null;

  method: string;
  action: "enabled" | "disabled";

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
