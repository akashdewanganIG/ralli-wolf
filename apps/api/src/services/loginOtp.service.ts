import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { sendLoginOtpEmail } from "./resendOtp.service.js";

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_MINUTES = 10;
export const OTP_EXPIRES_MS = OTP_EXPIRES_MINUTES * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Mints a fresh sign-in code for a user and emails it.
 *
 * Any code still outstanding for the user is burned first, so only the most
 * recently delivered code can ever be redeemed. If delivery fails the new
 * record is burned too — leaving a live code nobody received would only
 * consume the user's verify attempts.
 */
export async function issueLoginOtp(user: {
  id: number;
  email: string;
  firstName: string | null;
}) {
  const otp = randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString();
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);

  const record = await prisma.$transaction(async tx => {
    await tx.loginOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.loginOtp.create({
      data: { userId: user.id, otpHash, expiresAt },
    });
  });

  try {
    await sendLoginOtpEmail({
      to: user.email,
      firstName: user.firstName,
      otp,
      expiresInMinutes: OTP_EXPIRES_MINUTES,
      requestId: record.id,
    });
  } catch (emailError) {
    await prisma.loginOtp.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    console.error("Login OTP delivery failed", {
      requestId: record.id,
      error:
        emailError instanceof Error
          ? emailError.message
          : "Unknown Resend error",
    });
    throw new OtpDeliveryError();
  }

  return { otpId: record.id, expiresAt };
}

/** Raised when the code was minted but Resend refused to deliver it. */
export class OtpDeliveryError extends Error {
  constructor() {
    super("Unable to deliver the sign-in code");
    this.name = "OtpDeliveryError";
  }
}

/**
 * Shows enough of an address for the recipient to recognise their own inbox
 * without printing it in full: `ak****an@example.com`.
 */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  const head = local.slice(0, 2);
  const tail = local.slice(-1);
  return `${head}${"*".repeat(Math.max(2, local.length - 3))}${tail}@${domain}`;
}
