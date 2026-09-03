import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import {
  generateToken,
  generateResetToken,
  verifyResetToken,
  generateMfaToken,
} from "../utils/jwt.utils.js";
import { emailService } from "../services/email.service.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  handleError,
  handleValidationError,
  handleUnauthorizedError,
  handleNotFoundError,
  validateRequiredFields,
  ErrorCode,
} from "../utils/error-handler.js";
import { generateNumericOtp } from "../utils/password.utils.js";
import {
  issueLoginOtp,
  maskEmail,
  OTP_EXPIRES_MS,
  OtpDeliveryError,
} from "../services/login-otp.service.js";
import {
  clearFailedAttempts,
  describeRequest,
  notifyPasswordChanged,
  recordFailedAttempt,
} from "../services/login-security.service.js";
import { logWarn } from "../utils/logger.js";
import {
  requiredSignInChallenge,
  secondFactorFor,
  signInEntry,
} from "../services/auth-methods.service.js";
import { completeStaffSignIn } from "../services/auth-session.service.js";
import {
  bearerSessionResponse,
  clearStaffSessionCookie,
  setStaffSessionCookie,
} from "../utils/session-cookie.js";

async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (user || email.trim() === normalized) return user;
  return prisma.user.findUnique({ where: { email: email.trim() } });
}

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!validateRequiredFields(req.body, ["email"], res, "Login")) {
        return;
      }

      const user = await findUserByEmail(email);

      const rejectCredentials = () =>
        handleUnauthorizedError(
          res,
          "Invalid email or password",
          "Login",
          ErrorCode.INVALID_CREDENTIALS
        );

      if (!user) {
        return rejectCredentials();
      }

      if (user.deletedAt) {
        return handleUnauthorizedError(
          res,
          "This account has been deactivated. Contact your administrator to restore access.",
          "Login",
          ErrorCode.ACCOUNT_DEACTIVATED
        );
      }

      const entry = signInEntry(user);
      if (!entry) {
        return rejectCredentials();
      }

      if (entry === "password") {
        if (!user.passwordHash || !password) {
          return rejectCredentials();
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          recordFailedAttempt(user, "password", describeRequest(req));
          return rejectCredentials();
        }

        clearFailedAttempts(user.id);
      }

      const factor = secondFactorFor(user);
      const challenge = requiredSignInChallenge(user, entry);

      if (!challenge) {
        return completeStaffSignIn(req, res, user, "password");
      }

      if (challenge === "email") {
        try {
          await issueLoginOtp(user);
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
      }

      await recordAuditLog({
        action:
          entry === "password"
            ? "LOGIN_PASSWORD_VERIFIED"
            : "LOGIN_CHALLENGE_ISSUED",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json({
        mfaRequired: true,
        mfaToken: generateMfaToken(user.id, user.sessionVersion),
        maskedEmail: maskEmail(user.email),
        expiresIn: OTP_EXPIRES_MS / 1000,

        factor: challenge,

        availableFactors: factor.available.length
          ? factor.available
          : [challenge],
      });
    } catch (error) {
      handleError(error, res, "Login");
    }
  }

  async logout(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(res, "User not authenticated", "Logout");
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: { sessionVersion: { increment: 1 } },
      });

      clearStaffSessionCookie(res);

      res.json({
        message: "Logged out successfully",
      });
    } catch (error) {
      handleError(error, res, "Logout");
    }
  }

  async getCurrentUser(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "User not authenticated",
          "Get current user"
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return handleNotFoundError(res, "User", "Get current user");
      }

      const userResponse = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        role: user.role,
        permissions: user.permissions,
        mustChangePassword: user.mustChangePassword,
      };

      res.json(userResponse);
    } catch (error) {
      handleError(error, res, "Get current user");
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        return handleValidationError(
          res,
          "Email is required",
          "email",
          "Forgot password"
        );
      }

      const user = await findUserByEmail(email);
      if (!user || user.deletedAt) {
        return res.json({ success: true });
      }

      const otp = generateNumericOtp(6);
      const otpHash = await bcrypt.hash(otp, 12);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const resetRecord = await prisma.$transaction(async tx => {
        await tx.passwordReset.updateMany({
          where: { userId: user.id, completedAt: null },
          data: { usedAt: new Date(), completedAt: new Date() },
        });
        return tx.passwordReset.create({
          data: {
            userId: user.id,
            otpHash,
            expiresAt,
          },
        });
      });

      const userName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

      const delivered = await emailService.sendPasswordResetOtpEmail(
        user.email,
        userName,
        otp
      );

      if (!delivered) {
        await prisma.passwordReset.updateMany({
          where: { id: resetRecord.id, usedAt: null },
          data: { usedAt: new Date(), completedAt: new Date() },
        });
        logWarn("password_reset_code_delivery_failed", {
          userId: user.id,
        });
      }

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Forgot password");
    }
  }

  async verifyForgotPassword(req: Request, res: Response) {
    try {
      const { email, otp } = req.body as { email?: string; otp?: string };
      if (!email || !otp) {
        return handleValidationError(
          res,
          "Email and otp are required",
          undefined,
          "Verify OTP"
        );
      }

      const user = await findUserByEmail(email);
      if (!user || user.deletedAt) {
        return handleUnauthorizedError(res, "Invalid code", "Verify OTP");
      }

      const record = await prisma.passwordReset.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired code",
          "Verify OTP"
        );
      }

      if (record.attempts >= 5) {
        return handleUnauthorizedError(res, "Too many attempts", "Verify OTP");
      }

      const ok = await bcrypt.compare(otp, record.otpHash);
      if (!ok) {
        await prisma.passwordReset.updateMany({
          where: {
            id: record.id,
            usedAt: null,
            attempts: { lt: 5 },
          },
          data: { attempts: { increment: 1 } },
        });
        return handleUnauthorizedError(res, "Invalid code", "Verify OTP");
      }

      const claimed = await prisma.passwordReset.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          completedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return handleUnauthorizedError(
          res,
          "Invalid or expired code",
          "Verify OTP"
        );
      }

      const resetToken = generateResetToken(
        user.id,
        String(record.id),
        user.sessionVersion,
        "15m"
      );
      return res.json({ resetToken, expiresIn: 900 });
    } catch (error) {
      handleError(error, res, "Verify OTP");
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword } = req.body as {
        resetToken?: string;
        newPassword?: string;
      };
      if (!resetToken || !newPassword) {
        return handleValidationError(
          res,
          "resetToken and newPassword are required",
          undefined,
          "Reset password"
        );
      }
      if (newPassword.length < 8) {
        return handleValidationError(
          res,
          "Password must be at least 8 characters",
          "newPassword",
          "Reset password"
        );
      }

      let decoded;
      try {
        decoded = verifyResetToken(resetToken);
      } catch {
        return handleUnauthorizedError(
          res,
          "Invalid or expired reset token",
          "Reset password"
        );
      }

      const recId = Number(decoded.jti);
      if (!Number.isSafeInteger(recId) || recId <= 0) {
        return handleUnauthorizedError(
          res,
          "Invalid reset token",
          "Reset password"
        );
      }

      const hash = await bcrypt.hash(newPassword, 12);
      const completedAt = new Date();

      const changed = await prisma.$transaction(async tx => {
        const claimed = await tx.passwordReset.updateMany({
          where: {
            id: recId,
            userId: decoded.userId,
            usedAt: { not: null },
            completedAt: null,
          },
          data: { completedAt },
        });
        if (claimed.count !== 1) return null;

        const changedUser = await tx.user.updateMany({
          where: {
            id: decoded.userId,
            deletedAt: null,
            sessionVersion: decoded.sessionVersion,
          },
          data: {
            passwordHash: hash,
            mustChangePassword: false,
            sessionVersion: { increment: 1 },
          },
        });
        if (changedUser.count !== 1) return null;

        await tx.passwordReset.updateMany({
          where: { userId: decoded.userId, completedAt: null },
          data: { usedAt: completedAt, completedAt },
        });

        return tx.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, firstName: true },
        });
      });

      if (!changed) {
        return handleUnauthorizedError(
          res,
          "Invalid or already used reset token",
          "Reset password"
        );
      }

      notifyPasswordChanged(changed, "reset", describeRequest(req));

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Reset password");
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "User not authenticated",
          "Change password"
        );
      }
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        return handleValidationError(
          res,
          "currentPassword and newPassword are required",
          undefined,
          "Change password"
        );
      }
      if (newPassword.length < 8) {
        return handleValidationError(
          res,
          "Password must be at least 8 characters",
          "newPassword",
          "Change password"
        );
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        return handleNotFoundError(res, "User", "Change password");
      }

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) {
        return handleUnauthorizedError(
          res,
          "Current password is incorrect",
          "Change password"
        );
      }

      if (currentPassword === newPassword) {
        return handleValidationError(
          res,
          "Choose a password you have not used before",
          "newPassword",
          "Change password"
        );
      }

      const hash = await bcrypt.hash(newPassword, 12);
      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hash,
            mustChangePassword: false,
            sessionVersion: { increment: 1 },
          },
        }),
        prisma.passwordReset.updateMany({
          where: { userId: user.id, completedAt: null },
          data: { usedAt: new Date(), completedAt: new Date() },
        }),
      ]);

      notifyPasswordChanged(user, "changed", describeRequest(req));

      const token = generateToken(user.id, user.email, {
        sessionVersion: updatedUser.sessionVersion,
      });
      setStaffSessionCookie(res, token);
      return res.json({
        success: true,
        ...bearerSessionResponse(req, token),
      });
    } catch (error) {
      handleError(error, res, "Change password");
    }
  }
}
