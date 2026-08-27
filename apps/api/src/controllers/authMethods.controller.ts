import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  buildTotpEnrolment,
  activeMethods,
  canDisable,
  describeMethods,
  formatManualKey,
  generateTotpSecret,
  label,
  MINIMUM_METHODS,
  sealTotpSecret,
  verifyTotp,
  type AuthMethodUser,
} from "../services/authMethods.service.js";
import {
  issueLoginOtp,
  OtpDeliveryError,
  MAX_VERIFY_ATTEMPTS,
} from "../services/loginOtp.service.js";
import bcrypt from "bcryptjs";
import {
  describeRequest,
  notifyAuthMethodChanged,
  notifyPasswordChanged,
} from "../services/loginSecurity.service.js";
import {
  ErrorCode,
  handleError,
  handleUnauthorizedError,
  handleValidationError,
} from "../utils/errorHandler.js";

const METHOD_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  passwordEnabled: true,
  totpSecret: true,
  totpVerifiedAt: true,
  emailOtpVerifiedAt: true,
} as const;

async function loadUser(userId: number) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: METHOD_FIELDS,
  });
}

function summarise(user: AuthMethodUser) {
  const methods = describeMethods(user);
  return {
    minimumRequired: MINIMUM_METHODS,
    activeCount: methods.filter(m => m.enabled && m.verified).length,
    methods,
  };
}

export class AuthMethodsController {
  /** Current state of every method for the signed-in account. */
  async list(req: Request, res: Response) {
    try {
      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(
          res,
          "Account not found",
          "Auth methods"
        );
      return res.json(summarise(user));
    } catch (error) {
      return handleError(error, res, "Auth methods");
    }
  }

  /**
   * Begins authenticator enrolment: mints a secret, stores it sealed, and
   * returns the QR plus manual key. The method stays inactive until a code
   * from the app proves it in `verifyTotp`.
   */
  async startTotpSetup(req: Request, res: Response) {
    try {
      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(res, "Account not found", "TOTP setup");

      if (user.totpVerifiedAt) {
        return res.status(409).json({
          error: "An authenticator app is already set up for this account.",
          code: ErrorCode.CONFLICT,
        });
      }

      const secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: sealTotpSecret(secret), totpVerifiedAt: null },
      });

      const { otpauthUrl, qrCodeDataUrl, issuer } = await buildTotpEnrolment(
        user.email,
        secret
      );

      // The cleartext secret is returned exactly once, here, because the user
      // has to be able to type it into their app. It is never readable again.
      return res.json({
        qrCodeDataUrl,
        otpauthUrl,
        manualKey: formatManualKey(secret),
        issuer,
        accountName: user.email,
      });
    } catch (error) {
      return handleError(error, res, "TOTP setup");
    }
  }

  /** Confirms enrolment with a code from the authenticator app. */
  async verifyTotp(req: Request, res: Response) {
    try {
      const code =
        typeof req.body?.code === "string" ? req.body.code.trim() : "";
      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(res, "Account not found", "TOTP verify");

      if (!user.totpSecret) {
        return handleValidationError(
          res,
          "Start authenticator setup before entering a code.",
          "code",
          "TOTP verify"
        );
      }
      if (!/^\d{6}$/.test(code)) {
        return handleValidationError(
          res,
          "Enter the 6-digit code from your authenticator app.",
          "code",
          "TOTP verify"
        );
      }
      if (!verifyTotp(user.totpSecret, code)) {
        return handleUnauthorizedError(
          res,
          "That code is incorrect or has expired. Codes change every 30 seconds.",
          "TOTP verify",
          ErrorCode.INVALID_OTP
        );
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { totpVerifiedAt: new Date() },
        select: METHOD_FIELDS,
      });

      notifyAuthMethodChanged(
        updated,
        label("totp"),
        "enabled",
        activeMethods(updated).map(label),
        describeRequest(req)
      );

      await recordAuditLog({
        action: "AUTH_METHOD_ENABLED_TOTP",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json(summarise(updated));
    } catch (error) {
      return handleError(error, res, "TOTP verify");
    }
  }

  /** Emails a code to prove the address before enabling the email method. */
  async sendEmailCode(req: Request, res: Response) {
    try {
      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(
          res,
          "Account not found",
          "Email method"
        );

      if (user.emailOtpVerifiedAt) {
        return res.status(409).json({
          error: "Email codes are already enabled for this account.",
          code: ErrorCode.CONFLICT,
        });
      }

      try {
        await issueLoginOtp({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
        });
      } catch (otpError) {
        if (otpError instanceof OtpDeliveryError) {
          return res.status(503).json({
            error: "We could not send the code. Please try again in a moment.",
            code: ErrorCode.OTP_DELIVERY_FAILED,
          });
        }
        throw otpError;
      }

      return res.json({ success: true, email: user.email });
    } catch (error) {
      return handleError(error, res, "Email method");
    }
  }

  /** Confirms the emailed code and enables the method. */
  async verifyEmailCode(req: Request, res: Response) {
    try {
      const code =
        typeof req.body?.code === "string" ? req.body.code.trim() : "";
      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(
          res,
          "Account not found",
          "Email method"
        );

      if (!/^\d{6}$/.test(code)) {
        return handleValidationError(
          res,
          "Enter the 6-digit code from your email.",
          "code",
          "Email method"
        );
      }

      const record = await prisma.loginOtp.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      });

      if (!record || record.expiresAt <= new Date()) {
        return handleUnauthorizedError(
          res,
          "That code has expired. Send yourself a new one.",
          "Email method",
          ErrorCode.OTP_EXPIRED
        );
      }
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        return handleUnauthorizedError(
          res,
          "Too many incorrect attempts. Send a new code.",
          "Email method",
          ErrorCode.OTP_ATTEMPTS_EXCEEDED
        );
      }

      const valid = await bcrypt.compare(code, record.otpHash);
      if (!valid) {
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
          "That code is incorrect.",
          "Email method",
          ErrorCode.INVALID_OTP,
          { attemptsRemaining: Math.max(0, MAX_VERIFY_ATTEMPTS - attempts) }
        );
      }

      await prisma.loginOtp.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { emailOtpVerifiedAt: new Date() },
        select: METHOD_FIELDS,
      });

      notifyAuthMethodChanged(
        updated,
        label("email"),
        "enabled",
        activeMethods(updated).map(label),
        describeRequest(req)
      );

      await recordAuditLog({
        action: "AUTH_METHOD_ENABLED_EMAIL",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json(summarise(updated));
    } catch (error) {
      return handleError(error, res, "Email method");
    }
  }

  /**
   * Sets a password, enabling password sign-in.
   *
   * This is how an account that turned its password off gets one back, and it
   * is a deliberate re-entry of a new password rather than a switch that
   * revives the old hash: the person doing it should have to know the value
   * they are turning on.
   */
  async setPassword(req: Request, res: Response) {
    try {
      const newPassword =
        typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

      if (newPassword.length < 8) {
        return handleValidationError(
          res,
          "Password must be at least 8 characters.",
          "newPassword",
          "Auth methods"
        );
      }

      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(
          res,
          "Account not found",
          "Auth methods"
        );

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          passwordEnabled: true,
          // A password just chosen by its owner is not one they must change.
          mustChangePassword: false,
        },
        select: METHOD_FIELDS,
      });

      notifyPasswordChanged(updated, "enabled", describeRequest(req));

      await recordAuditLog({
        action: "AUTH_METHOD_ENABLED_PASSWORD",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json(summarise(updated));
    } catch (error) {
      return handleError(error, res, "Auth methods");
    }
  }

  /**
   * Turns a method off. The minimum is enforced here, not just in the UI: a
   * client that skips the check still cannot strand an account on one factor.
   */
  async disable(req: Request, res: Response) {
    try {
      const method = req.params.method;
      if (method !== "totp" && method !== "email" && method !== "password") {
        return handleValidationError(
          res,
          "Unknown authentication method.",
          "method",
          "Auth methods"
        );
      }

      const user = await loadUser(req.user!.id);
      if (!user)
        return handleUnauthorizedError(
          res,
          "Account not found",
          "Auth methods"
        );

      // Password is disableable like anything else now; `canDisable` is what
      // stops an account being left with no way to start a sign-in.
      const verdict = canDisable(user, method);
      if (!verdict.allowed) {
        return res.status(409).json({
          error: verdict.reason,
          code: ErrorCode.CONFLICT,
          ...summarise(user),
        });
      }

      // The password hash is deliberately left in place: clearing it would
      // make re-enabling a password a reset flow rather than a toggle, and the
      // login route refuses a password whenever `passwordEnabled` is false, so
      // a retained hash grants nothing on its own.
      const updated = await prisma.user.update({
        where: { id: user.id },
        data:
          method === "totp"
            ? { totpVerifiedAt: null, totpSecret: null }
            : method === "email"
              ? { emailOtpVerifiedAt: null }
              : { passwordEnabled: false },
        select: METHOD_FIELDS,
      });

      // The message that matters most: a second factor coming off is exactly
      // what someone with a stolen session would do first.
      notifyAuthMethodChanged(
        updated,
        label(method),
        "disabled",
        activeMethods(updated).map(label),
        describeRequest(req)
      );

      await recordAuditLog({
        action:
          method === "totp"
            ? "AUTH_METHOD_DISABLED_TOTP"
            : method === "email"
              ? "AUTH_METHOD_DISABLED_EMAIL"
              : "AUTH_METHOD_DISABLED_PASSWORD",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json(summarise(updated));
    } catch (error) {
      return handleError(error, res, "Auth methods");
    }
  }
}
