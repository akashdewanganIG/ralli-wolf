import { Resend } from "resend";

interface LoginOtpEmailInput {
  to: string;
  firstName?: string | null;
  otp: string;
  expiresInMinutes: number;
  requestId: number;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    throw new Error("Resend OTP email is not configured");
  }

  return {
    resend: new Resend(apiKey),
    from,
    replyTo: process.env.RESEND_REPLY_TO?.trim() || undefined,
  };
}

function buildLoginOtpEmail({
  firstName,
  otp,
  expiresInMinutes,
}: LoginOtpEmailInput) {
  const safeName = escapeHtml(firstName?.trim() || "there");
  const safeOtp = escapeHtml(otp);

  const text = [
    `Hi ${firstName?.trim() || "there"},`,
    "",
    `Your Ralli Wolf sign-in code is ${otp}.`,
    `It expires in ${expiresInMinutes} minutes and can be used only once.`,
    "",
    "If you did not request this code, you can safely ignore this email.",
    "Ralli Wolf Operations",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Ralli Wolf sign-in code</title>
  </head>
  <body style="margin:0;background:#f5f6f8;color:#182230;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use ${safeOtp} to sign in to Ralli Wolf Operations.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:#ed1c24;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 24px;color:#ed1c24;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Ralli Wolf Operations</p>
                <h1 style="margin:0 0 12px;color:#101828;font-size:24px;line-height:1.3;font-weight:700;">Your sign-in code</h1>
                <p style="margin:0 0 24px;color:#475467;font-size:15px;line-height:1.65;">Hi ${safeName}, use the verification code below to securely access your workspace.</p>
                <div style="margin:0 0 24px;padding:20px 24px;background:#fff5f5;border:1px solid #fecaca;border-radius:12px;text-align:center;">
                  <span style="color:#b5121b;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:.24em;">${safeOtp}</span>
                </div>
                <p style="margin:0;color:#667085;font-size:13px;line-height:1.6;">This code expires in ${expiresInMinutes} minutes and works once. Ralli Wolf will never ask you to share it.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eaecf0;padding:20px 32px;color:#98a2b3;font-size:12px;line-height:1.5;">If you did not request this email, no action is required.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export async function sendLoginOtpEmail(input: LoginOtpEmailInput) {
  const { resend, from, replyTo } = getResendConfig();
  const content = buildLoginOtpEmail(input);
  const { error } = await resend.emails.send(
    {
      from,
      to: [input.to],
      replyTo,
      subject: `${input.otp} is your Ralli Wolf sign-in code`,
      html: content.html,
      text: content.text,
      tags: [{ name: "category", value: "login_otp" }],
    },
    { idempotencyKey: `login-otp/${input.requestId}` }
  );

  if (error) {
    throw new Error(`Resend rejected the OTP email: ${error.message}`);
  }
}
