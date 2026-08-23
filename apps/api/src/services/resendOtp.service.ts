import { renderEmail } from "./emailTemplate.js";
import { sendResendEmail } from "./resendClient.js";

interface LoginOtpEmailInput {
  to: string;
  firstName?: string | null;
  otp: string;
  expiresInMinutes: number;
  requestId: number;
}

function buildLoginOtpEmail({
  firstName,
  otp,
  expiresInMinutes,
}: LoginOtpEmailInput) {
  const name = firstName?.trim() || "there";

  const text = [
    `Hi ${name},`,
    "",
    `Your Ralli Wolf sign-in code is ${otp}.`,
    `It expires in ${expiresInMinutes} minutes and can be used only once.`,
    "",
    "If you did not request this code, you can safely ignore this email.",
    "Ralli Wolf Operations",
  ].join("\n");

  const html = renderEmail({
    // The code leads the preview: on a phone it is often the only thing the
    // recipient needs to read.
    preview: `${otp} is your Ralli Wolf sign-in code.`,
    eyebrow: "Sign-in verification",
    heading: "Your sign-in code",
    paragraphs: [
      `Hi ${name}, use the code below to finish signing in to your workspace.`,
    ],
    code: otp,
    note: `This code expires in ${expiresInMinutes} minutes and works once. Ralli Wolf will never ask you to share it.`,
    footer: "If you did not request this email, no action is required.",
  });

  return { html, text };
}

export async function sendLoginOtpEmail(input: LoginOtpEmailInput) {
  const content = buildLoginOtpEmail(input);
  await sendResendEmail({
    to: input.to,
    subject: `${input.otp} is your Ralli Wolf sign-in code`,
    html: content.html,
    text: content.text,
    category: "login_otp",
    idempotencyKey: `login-otp/${input.requestId}`,
  });
}
