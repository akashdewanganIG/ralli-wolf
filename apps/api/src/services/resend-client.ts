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

export interface ResendAttachment {
  filename: string;

  content: string | Buffer;
  contentType?: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;

  text?: string;

  category: string;

  idempotencyKey?: string;
  cc?: string[];
  bcc?: string[];

  replyTo?: string;
  attachments?: ResendAttachment[];
}

export function plainTextFrom(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  category,
  idempotencyKey,
  cc,
  bcc,
  replyTo,
  attachments,
}: SendEmailInput): Promise<{ id: string }> {
  const config = getResendConfig();
  const { data, error } = await config.resend.emails.send(
    {
      from: config.from,
      to: [to],
      replyTo: replyTo ?? config.replyTo,
      subject,
      html,
      text: text ?? plainTextFrom(html),
      tags: [{ name: "category", value: category }],
      ...(cc?.length ? { cc } : {}),
      ...(bcc?.length ? { bcc } : {}),
      ...(attachments?.length ? { attachments } : {}),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw new Error(`Resend rejected the email: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend accepted the email but returned no message id");
  }

  return { id: data.id };
}
