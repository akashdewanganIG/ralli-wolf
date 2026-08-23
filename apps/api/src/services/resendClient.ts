import { Resend } from "resend";

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    throw new Error("Resend email is not configured");
  }

  return {
    resend: new Resend(apiKey),
    from,
    replyTo: process.env.RESEND_REPLY_TO?.trim() || undefined,
  };
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Groups the send in Resend's dashboard, e.g. `login_otp`. */
  category: string;
  /** Stops a retried call from delivering the same message twice. */
  idempotencyKey?: string;
}

export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  category,
  idempotencyKey,
}: SendEmailInput) {
  const { resend, from, replyTo } = getResendConfig();
  const { error } = await resend.emails.send(
    {
      from,
      to: [to],
      replyTo,
      subject,
      html,
      text,
      tags: [{ name: "category", value: category }],
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw new Error(`Resend rejected the email: ${error.message}`);
  }
}
