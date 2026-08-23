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

  await sendResendEmail({
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

  await sendResendEmail({
    to: input.to,
    subject: "Failed sign-in attempts on your Ralli Wolf account",
    html,
    text,
    category: "login_warning",
  });
}
