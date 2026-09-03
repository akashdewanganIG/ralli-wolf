import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { verifyMfaToken } from "../utils/jwt.utils.js";
import {
  issueLoginOtp,
  maskEmail,
  MAX_VERIFY_ATTEMPTS,
  OTP_EXPIRES_MS,
  OtpDeliveryError,
} from "../services/login-otp.service.js";
import { verifyTotp } from "../services/auth-methods.service.js";
import {
  ErrorCode,
  handleError,
  handleForbiddenError,
  handleUnauthorizedError,
  handleValidationError,
} from "../utils/error-handler.js";
import {
  describeRequest,
  recordFailedAttempt,
} from "../services/login-security.service.js";
import { completeStaffSignIn } from "../services/auth-session.service.js";

async function resolveMfaSession(req: Request, res: Response, context: string) {
  const mfaToken =
    typeof req.body?.mfaToken === "string" ? req.body.mfaToken.trim() : "";

  if (!mfaToken) {
    handleValidationError(
      res,
      "Your sign-in session is missing. Please enter your password again.",
      "mfaToken",
      context
    );
    return null;
  }

  let payload;
  try {
    payload = verifyMfaToken(mfaToken);
  } catch {
    handleUnauthorizedError(
      res,
      "Your sign-in session expired. Please enter your password again.",
      context,
      ErrorCode.MFA_SESSION_EXPIRED
    );
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.deletedAt) {
    handleUnauthorizedError(
      res,
      "Your sign-in session expired. Please enter your password again.",
      context,
      ErrorCode.MFA_SESSION_EXPIRED
    );
    return null;
  }

  if (user.sessionVersion !== payload.sessionVersion) {
    handleUnauthorizedError(
      res,
      "Your sign-in session expired. Please enter your password again.",
      context,
      ErrorCode.MFA_SESSION_EXPIRED
    );
    return null;
  }

  return { user };
}

export class LoginOtpController {
  async resend(req: Request, res: Response) {
    try {
      const session = await resolveMfaSession(req, res, "Resend login OTP");
      if (!session) return;

      if (!session.user.emailOtpVerifiedAt) {
        return handleForbiddenError(
          res,
          "Email code authentication is not enabled for this account",
          "Resend login OTP"
        );
      }

      try {
        await issueLoginOtp(session.user);
      } catch (otpError) {
        if (otpError instanceof OtpDeliveryError) {
          return res.status(503).json({
            error:
              "We could not email your sign-in code. Please try again in a moment.",
            code: ErrorCode.OTP_DELIVERY_FAILED,
          });
        }
        throw otpError;
      }

      return res.json({
        success: true,
        maskedEmail: maskEmail(session.user.email),
        expiresIn: OTP_EXPIRES_MS / 1000,
      });
    } catch (error) {
      return handleError(error, res, "Resend login OTP");
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

      const session = await resolveMfaSession(req, res, "Verify login OTP");
      if (!session) return;
      const { user } = session;

      if (!/^\d{6}$/.test(otp)) {
        return handleValidationError(
          res,
          "Enter the 6-digit code from your email",
          "otp",
          "Verify login OTP"
        );
      }

      if (
        user.totpVerifiedAt &&
        user.totpSecret &&
        verifyTotp(user.totpSecret, otp)
      ) {
        return completeStaffSignIn(req, res, user, "totp");
      }

      if (!user.emailOtpVerifiedAt) {
        recordFailedAttempt(user, "code", describeRequest(req));
        return handleUnauthorizedError(
          res,
          "That code is incorrect",
          "Verify login OTP",
          ErrorCode.INVALID_OTP
        );
      }

      const record = await prisma.loginOtp.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
        return handleUnauthorizedError(
          res,
          "That code has already been used. Request a new one.",
          "Verify login OTP",
          ErrorCode.OTP_EXPIRED
        );
      }

      if (record.expiresAt <= new Date()) {
        return handleUnauthorizedError(
          res,
          "That code has expired. Request a new one.",
          "Verify login OTP",
          ErrorCode.OTP_EXPIRED
        );
      }

      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        return handleUnauthorizedError(
          res,
          "Too many incorrect attempts. Request a new code.",
          "Verify login OTP",
          ErrorCode.OTP_ATTEMPTS_EXCEEDED
        );
      }

      const isValid = await bcrypt.compare(otp, record.otpHash);
      if (!isValid) {
        recordFailedAttempt(user, "code", describeRequest(req));
        const attempts = record.attempts + 1;
        const exhausted = attempts >= MAX_VERIFY_ATTEMPTS;
        await prisma.loginOtp.updateMany({
          where: {
            id: record.id,
            usedAt: null,
            attempts: { lt: MAX_VERIFY_ATTEMPTS },
          },
          data: {
            attempts: { increment: 1 },
            usedAt: exhausted ? new Date() : undefined,
          },
        });
        return handleUnauthorizedError(
          res,
          exhausted
            ? "Too many incorrect attempts. Request a new code."
            : "That code is incorrect",
          "Verify login OTP",
          exhausted ? ErrorCode.OTP_ATTEMPTS_EXCEEDED : ErrorCode.INVALID_OTP,
          { attemptsRemaining: Math.max(0, MAX_VERIFY_ATTEMPTS - attempts) }
        );
      }

      const claimed = await prisma.loginOtp.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_VERIFY_ATTEMPTS },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return handleUnauthorizedError(
          res,
          "That code has already been used. Request a new one.",
          "Verify login OTP",
          ErrorCode.OTP_EXPIRED
        );
      }

      await prisma.loginOtp.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      return completeStaffSignIn(req, res, user, "email");
    } catch (error) {
      return handleError(error, res, "Verify login OTP");
    }
  }
}
