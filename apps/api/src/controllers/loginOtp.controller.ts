import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "@repo/db";
import { sendLoginOtpEmail } from "../services/resendOtp.service.js";
import { generateToken } from "../utils/jwt.utils.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  handleError,
  handleUnauthorizedError,
  handleValidationError,
} from "../utils/errorHandler.js";

const OTP_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;
const OTP_EXPIRES_MS = OTP_EXPIRES_MINUTES * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  "If an active account matches that email, a sign-in code has been sent.";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isDeveloperAccount(
  email: string,
  role: UserRole,
  firstName?: string | null,
  lastName?: string | null
) {
  const configuredEmail =
    process.env.DEVELOPER_LOGIN_EMAIL?.trim().toLowerCase();
  const configuredName = (
    process.env.DEVELOPER_LOGIN_NAME || "Developer Access"
  )
    .trim()
    .toLowerCase();
  const fullName = `${firstName || ""} ${lastName || ""}`.trim().toLowerCase();

  return (
    (!!configuredEmail && email === configuredEmail) ||
    (role === UserRole.ADMIN && fullName === configuredName)
  );
}

function buildUserResponse(user: {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  role: UserRole;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export class LoginOtpController {
  async request(req: Request, res: Response) {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!email || !isEmail(email)) {
        return handleValidationError(
          res,
          "Enter a valid email address",
          "email",
          "Request login OTP"
        );
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (
        !user ||
        user.deletedAt ||
        isDeveloperAccount(
          user.email.toLowerCase(),
          user.role,
          user.firstName,
          user.lastName
        )
      ) {
        return res.json({
          success: true,
          message: GENERIC_REQUEST_MESSAGE,
          expiresIn: OTP_EXPIRES_MS / 1000,
        });
      }

      const otp = randomInt(
        10 ** (OTP_LENGTH - 1),
        10 ** OTP_LENGTH
      ).toString();
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
      }

      return res.json({
        success: true,
        message: GENERIC_REQUEST_MESSAGE,
        expiresIn: OTP_EXPIRES_MS / 1000,
      });
    } catch (error) {
      return handleError(error, res, "Request login OTP");
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

      if (!email || !isEmail(email) || !/^\d{6}$/.test(otp)) {
        return handleValidationError(
          res,
          "Enter a valid email address and 6-digit code",
          undefined,
          "Verify login OTP"
        );
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (
        !user ||
        user.deletedAt ||
        isDeveloperAccount(
          user.email.toLowerCase(),
          user.role,
          user.firstName,
          user.lastName
        )
      ) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired sign-in code",
          "Verify login OTP"
        );
      }

      const record = await prisma.loginOtp.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!record || record.attempts >= MAX_VERIFY_ATTEMPTS) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired sign-in code",
          "Verify login OTP"
        );
      }

      const isValid = await bcrypt.compare(otp, record.otpHash);
      if (!isValid) {
        const attempts = record.attempts + 1;
        await prisma.loginOtp.update({
          where: { id: record.id },
          data: {
            attempts,
            usedAt: attempts >= MAX_VERIFY_ATTEMPTS ? new Date() : undefined,
          },
        });
        return handleUnauthorizedError(
          res,
          "Invalid or expired sign-in code",
          "Verify login OTP"
        );
      }

      const claimed = await prisma.loginOtp.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired sign-in code",
          "Verify login OTP"
        );
      }

      await prisma.loginOtp.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = generateToken(user.id, user.email);
      await recordAuditLog({
        action: "LOGIN_WITH_EMAIL_OTP",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json({
        token,
        user: buildUserResponse(user),
        isDeveloper: false,
      });
    } catch (error) {
      return handleError(error, res, "Verify login OTP");
    }
  }
}
