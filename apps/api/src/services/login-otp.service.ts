import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { sendLoginOtpEmail } from "./resend-otp.service.js";
import { logError, logInfo } from "../utils/logger.js";

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_MINUTES = 10;
export const OTP_EXPIRES_MS = OTP_EXPIRES_MINUTES * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;

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
    const { id: messageId } = await sendLoginOtpEmail({
      to: user.email,
      firstName: user.firstName,
      otp,
      expiresInMinutes: OTP_EXPIRES_MINUTES,
      requestId: record.id,
    });

    logInfo("login_otp_dispatched", {
      requestId: record.id,
      userId: user.id,
      messageId,
    });
  } catch (emailError) {
    await prisma.loginOtp.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    logError("login_otp_delivery_failed", emailError, {
      requestId: record.id,
    });
    throw new OtpDeliveryError();
  }

  return { otpId: record.id, expiresAt };
}

export class OtpDeliveryError extends Error {
  constructor() {
    super("Unable to deliver the sign-in code");
    this.name = "OtpDeliveryError";
  }
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  const head = local.slice(0, 2);
  const tail = local.slice(-1);
  return `${head}${"*".repeat(Math.max(2, local.length - 3))}${tail}@${domain}`;
}
