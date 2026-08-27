import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "@repo/db";
import { generateToken, verifyMfaToken } from "../utils/jwt.utils.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  issueLoginOtp,
  maskEmail,
  MAX_VERIFY_ATTEMPTS,
  OTP_EXPIRES_MS,
  OtpDeliveryError,
} from "../services/loginOtp.service.js";
import { verifyTotp } from "../services/authMethods.service.js";
import {
  ErrorCode,
  handleError,
  handleUnauthorizedError,
  handleValidationError,
} from "../utils/errorHandler.js";
import {
  clearFailedAttempts,
  describeRequest,
  notifySuccessfulLogin,
  recordFailedAttempt,
} from "../services/loginSecurity.service.js";

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

/**
 * Resolves the MFA token minted by `POST /auth/login` back to a user.
 *
 * Returns `null` after having already answered the request, so callers can
 * simply `if (!resolved) return;`.
 */
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

/**
 * Mints the session once a second factor has been proved.
 *
 * Shared by both challenge types so an authenticator code and an emailed
 * code produce identical sessions, audit trails and alerts.
 */
async function completeSignIn(
  req: Request,
  res: Response,
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
    role: UserRole;
    mustChangePassword: boolean;
  },
  via: "email" | "totp" = "email"
) {
  const token = generateToken(user.id, user.email);
  clearFailedAttempts(user.id);
  notifySuccessfulLogin(user, describeRequest(req));
  await recordAuditLog({
    action:
      via === "totp" ? "LOGIN_WITH_AUTHENTICATOR" : "LOGIN_WITH_EMAIL_OTP",
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
}

export class LoginOtpController {
  /**
   * Sends a replacement code for an in-flight sign-in. Requires the MFA token,
   * so codes can only be triggered by someone who already knows the password.
   */
  async resend(req: Request, res: Response) {
    try {
      const session = await resolveMfaSession(req, res, "Resend login OTP");
      if (!session) return;

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

      // The old MFA token stays valid: it identifies the user, and `verify`
      // always redeems whichever code is currently outstanding for them.
      return res.json({
        success: true,
        maskedEmail: maskEmail(session.user.email),
        expiresIn: OTP_EXPIRES_MS / 1000,
      });
    } catch (error) {
      return handleError(error, res, "Resend login OTP");
    }
  }

  /** Step two of two: exchanges a valid code for a session token. */
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

      // An enrolled authenticator is checked first: its code is valid
      // without any emailed record existing at all.
      if (
        user.totpVerifiedAt &&
        user.totpSecret &&
        verifyTotp(user.totpSecret, otp)
      ) {
        return completeSignIn(req, res, user, "totp");
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
        await prisma.loginOtp.update({
          where: { id: record.id },
          data: { attempts, usedAt: exhausted ? new Date() : undefined },
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

      // Claim the code before minting a token, so two concurrent requests
      // carrying the same code cannot both succeed.
      const claimed = await prisma.loginOtp.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
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

      return completeSignIn(req, res, user, "email");
    } catch (error) {
      return handleError(error, res, "Verify login OTP");
    }
  }
}
