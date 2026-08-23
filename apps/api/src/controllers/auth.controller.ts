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
import { UserRole } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleUnauthorizedError,
  handleNotFoundError,
  handleForbiddenError,
  handleConflictError,
  validateRequiredFields,
  ErrorCode,
} from "../utils/errorHandler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
} from "../utils/validators.js";
import { parsePhoneNumber } from "../utils/phoneHelper.js";
import {
  generateNumericOtp,
  generateUserPassword,
} from "../utils/password.utils.js";
import {
  issueLoginOtp,
  maskEmail,
  OTP_EXPIRES_MS,
  OtpDeliveryError,
} from "../services/loginOtp.service.js";
import {
  clearFailedAttempts,
  describeRequest,
  recordFailedAttempt,
} from "../services/loginSecurity.service.js";
import { secondFactorFor } from "../services/authMethods.service.js";

const developerEmailConfigured = process.env.DEVELOPER_LOGIN_EMAIL?.trim();
const developerEmailNormalized = developerEmailConfigured
  ? developerEmailConfigured.toLowerCase()
  : undefined;
const developerPasswordConfigured = process.env.DEVELOPER_LOGIN_PASSWORD;
const developerNameConfigured =
  process.env.DEVELOPER_LOGIN_NAME || "Developer Access";

export class AuthController {
  /**
   * Step one of two. Verifies the password, then emails a one-time code and
   * hands back a short-lived MFA token; no session token is issued here.
   *
   * An unknown email and a wrong password are reported identically, so this
   * route cannot be used to discover which addresses hold accounts. When the
   * address *is* real, repeated failures warn its owner by email instead.
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (
        !validateRequiredFields(req.body, ["email", "password"], res, "Login")
      ) {
        return;
      }

      // Normalize email: trim whitespace and convert to lowercase for consistent matching
      const normalizedEmail = email.trim().toLowerCase();

      // Find user by email - try normalized email first, then original if different
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // If not found with normalized email, try original email (in case it was stored differently)
      if (!user && email.trim() !== normalizedEmail) {
        user = await prisma.user.findUnique({
          where: { email: email.trim() },
        });
      }

      // One shape for every credential failure: revealing which half was
      // wrong would turn this route into an account-existence oracle.
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

      const developerName = (
        process.env.DEVELOPER_LOGIN_NAME || "Developer Access"
      ).toLowerCase();
      const userFullName = `${user.firstName || ""} ${user.lastName || ""}`
        .trim()
        .toLowerCase();
      if (
        (developerEmailNormalized &&
          user.email.trim().toLowerCase() === developerEmailNormalized) ||
        (user.role === UserRole.ADMIN && userFullName === developerName)
      ) {
        return handleForbiddenError(
          res,
          "Developer access requires the dedicated login route",
          "Login"
        );
      }

      if (!user.passwordHash) {
        return rejectCredentials();
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        // The address is real, so its owner is the one who should hear about
        // a run of failures.
        recordFailedAttempt(user, "password", describeRequest(req));
        return rejectCredentials();
      }

      clearFailedAttempts(user.id);

      // Password checked out. Everything past this point is the second
      // factor, so a session token is only minted by /login/otp/verify.
      const factor = secondFactorFor(user);

      // An enrolled authenticator needs no email round-trip; only fall back
      // to a mailed code when that is what the account actually has.
      let otpId = 0;
      if (factor.preferred === "email") {
        try {
          ({ otpId } = await issueLoginOtp(user));
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
        action: "LOGIN_PASSWORD_VERIFIED",
        changedBy: user.id,
        entityType: "USER_AUTH",
        entityId: user.id,
        oldValues: null,
        newValues: null,
      });

      return res.json({
        mfaRequired: true,
        mfaToken: generateMfaToken(user.id, otpId),
        maskedEmail: maskEmail(user.email),
        expiresIn: OTP_EXPIRES_MS / 1000,
        /** Which challenge the client should show, and what it may switch to. */
        factor: factor.preferred ?? "email",
        availableFactors: factor.available,
      });
    } catch (error) {
      handleError(error, res, "Login");
    }
  }

  async logout(req: Request, res: Response) {
    try {
      if (req.user?.isDeveloper) {
        await recordAuditLog({
          action: "DEVELOPER_LOGOUT",
          changedBy: req.user.id,
          entityType: "DEVELOPER_AUTH",
          entityId: req.user.id,
          oldValues: null,
          newValues: null,
        });
      }

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

      // Fetch full user details from database
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return handleNotFoundError(res, "User", "Get current user");
      }

      // Return user data (excluding password hash)
      const userResponse = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        isDeveloper: req.user?.isDeveloper ?? false,
      };

      res.json(userResponse);
    } catch (error) {
      handleError(error, res, "Get current user");
    }
  }

  async createTestAdmin(req: Request, res: Response) {
    try {
      // This helper is intentionally unavailable in production and opt-in elsewhere.
      const { secret } = req.body;
      const expectedSecret = process.env.TEST_ADMIN_SECRET?.trim();

      if (process.env.NODE_ENV === "production" || !expectedSecret) {
        return handleNotFoundError(res, "Route", "Create test admin");
      }

      if (secret !== expectedSecret) {
        return handleForbiddenError(
          res,
          "Invalid secret token",
          "Create test admin"
        );
      }

      // Check if test admin already exists
      const existingAdmin = await prisma.user.findUnique({
        where: { email: "superadmin@example.com" },
      });

      if (existingAdmin) {
        return res.status(200).json({
          message: "Test admin already exists",
        });
      }

      // Create test admin user
      const passwordHash = await bcrypt.hash("admin123", 10);

      await prisma.user.create({
        data: {
          firstName: "Super",
          lastName: "Admin",
          email: "superadmin@example.com",
          passwordHash,
          role: UserRole.ADMIN,
        },
      });

      res.status(201).json({
        message: "Test admin created successfully",
      });
    } catch (error) {
      handleError(error, res, "Create test admin");
    }
  }

  async developerLogin(req: Request, res: Response) {
    try {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };

      if (!developerEmailConfigured || !developerPasswordConfigured) {
        return handleForbiddenError(
          res,
          "Developer credentials not configured",
          "Developer login"
        );
      }

      if (!email || !password) {
        return handleValidationError(
          res,
          "Email and password are required",
          undefined,
          "Developer login"
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (
        !developerEmailNormalized ||
        normalizedEmail !== developerEmailNormalized
      ) {
        return handleUnauthorizedError(
          res,
          "Invalid developer credentials",
          "Developer login"
        );
      }

      if (password !== developerPasswordConfigured) {
        return handleUnauthorizedError(
          res,
          "Invalid developer credentials",
          "Developer login"
        );
      }

      let developerUser = await prisma.user.findUnique({
        where: { email: developerEmailConfigured },
      });

      const ensurePasswordHash = async () =>
        bcrypt.hash(developerPasswordConfigured!, 10);

      // Parse developer name into firstName/lastName
      const developerNameParts = developerNameConfigured.split(" ");
      const developerFirstName = developerNameParts[0] || "Developer";
      const developerLastName =
        developerNameParts.slice(1).join(" ") || "Access";

      if (!developerUser) {
        developerUser = await prisma.user.create({
          data: {
            email: developerEmailConfigured,
            firstName: developerFirstName,
            lastName: developerLastName,
            passwordHash: await ensurePasswordHash(),
            role: UserRole.ADMIN,
          },
        });
      } else {
        const updates: Record<string, unknown> = {};

        if (developerUser.role !== UserRole.ADMIN) {
          updates.role = UserRole.ADMIN;
        }

        if (developerUser.firstName !== developerFirstName) {
          updates.firstName = developerFirstName;
        }
        if (developerUser.lastName !== developerLastName) {
          updates.lastName = developerLastName;
        }

        const passwordMatches = await bcrypt.compare(
          developerPasswordConfigured!,
          developerUser.passwordHash
        );

        if (!passwordMatches) {
          updates.passwordHash = await ensurePasswordHash();
        }

        if (Object.keys(updates).length > 0) {
          developerUser = await prisma.user.update({
            where: { id: developerUser.id },
            data: updates,
          });
        }
      }

      const token = generateToken(developerUser.id, developerUser.email, {
        isDeveloper: true,
      });

      const userResponse = {
        id: developerUser.id,
        email: developerUser.email,
        firstName: developerUser.firstName,
        lastName: developerUser.lastName,
        createdAt: developerUser.createdAt,
        role: developerUser.role,
      };

      await recordAuditLog({
        action: "DEVELOPER_LOGIN",
        changedBy: developerUser.id,
        entityType: "DEVELOPER_AUTH",
        entityId: developerUser.id,
        oldValues: null,
        newValues: {
          email: developerUser.email,
        },
      });

      res.json({
        token,
        user: userResponse,
        isDeveloper: true,
      });
    } catch (error) {
      handleError(error, res, "Developer login");
    }
  }

  /**
   * Start forgot password: generate OTP and email it
   * POST /api/auth/forgot-password { email }
   */
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

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Do not reveal existence; respond success
        return res.json({ success: true });
      }

      // Create 6-digit numeric OTP. Cost 12 matches the sign-in OTP: a 6-digit
      // code is only 20 bits, so the hash needs to be expensive to attack.
      const otp = generateNumericOtp(6);
      const otpHash = await bcrypt.hash(otp, 12);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create reset record
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt,
        },
      });

      const masked = email.replace(/(^.).*(@.*$)/, (_m, a, b) => `${a}***${b}`);
      const userName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
      const subject = "Your password reset code";
      const body = `Hi ${userName},\n\nYour password reset code is: ${otp}\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.\n\nRequested for: ${masked}`;
      await emailService.sendEmail({
        to: email,
        subject,
        body,
        name: userName,
      });

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Forgot password");
    }
  }

  /**
   * Verify OTP and return a short-lived reset token
   * POST /api/auth/forgot-password/verify { email, otp }
   */
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

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return handleUnauthorizedError(res, "Invalid code", "Verify OTP");
      }

      // Get latest non-used, non-expired reset entry
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
        await prisma.passwordReset.update({
          where: { id: record.id },
          data: { attempts: record.attempts + 1 },
        });
        return handleUnauthorizedError(res, "Invalid code", "Verify OTP");
      }

      // Mark usedAt to prevent reuse of OTP itself, but keep row for jti mapping
      const updated = await prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Use record id as jti
      const resetToken = generateResetToken(user.id, String(updated.id), "15m");
      return res.json({ resetToken, expiresIn: 900 });
    } catch (error) {
      handleError(error, res, "Verify OTP");
    }
  }

  /**
   * Reset password with resetToken
   * POST /api/auth/forgot-password/reset { resetToken, newPassword }
   */
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

      const decoded = verifyResetToken(resetToken);

      // Ensure the referenced reset record exists and is not expired beyond grace
      const recId = Number(decoded.jti);
      const rec = await prisma.passwordReset.findUnique({
        where: { id: recId },
      });
      if (!rec || rec.userId !== decoded.userId) {
        return handleUnauthorizedError(
          res,
          "Invalid reset token",
          "Reset password"
        );
      }

      const hash = await bcrypt.hash(newPassword, 10);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: decoded.userId },
          data: { passwordHash: hash, mustChangePassword: false },
        }),
        // Invalidate all outstanding reset requests for user
        prisma.passwordReset.updateMany({
          where: { userId: decoded.userId, usedAt: null },
          data: { usedAt: new Date() },
        }),
      ]);

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Reset password");
    }
  }

  /**
   * Change password for authenticated user
   * POST /api/auth/change-password { currentPassword, newPassword }
   */
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

      // Reusing the emailed password would defeat the point of forcing a change.
      if (currentPassword === newPassword) {
        return handleValidationError(
          res,
          "Choose a password you have not used before",
          "newPassword",
          "Change password"
        );
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash, mustChangePassword: false },
      });

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Change password");
    }
  }

  /**
   * Create a system admin user (protected by ADMIN-SECRET)
   * POST /api/auth/create-system-admin
   * Requires: ADMIN_SECRET environment variable
   */
  async createSystemAdmin(req: Request, res: Response) {
    try {
      // Ensure request body is parsed
      if (!req.body || typeof req.body !== "object") {
        return handleValidationError(
          res,
          "Request body is required. Please ensure Content-Type is application/json and body is properly formatted.",
          "body",
          "Create system admin"
        );
      }

      const { firstName, lastName, email, phone, role } = req.body;

      // Validate required fields
      const requiredFields = ["firstName", "lastName", "email", "role"];
      if (
        !validateRequiredFields(
          req.body,
          requiredFields,
          res,
          "Create system admin"
        )
      ) {
        return;
      }

      // Normalize email: trim whitespace and convert to lowercase for consistent storage
      const normalizedEmail = email.trim().toLowerCase();

      // Validate firstName
      if (!isValidName(firstName)) {
        return handleValidationError(
          res,
          "First name is required and must be non-empty (max 255 characters)",
          "firstName",
          "Create system admin"
        );
      }

      // Validate lastName
      if (!isValidName(lastName)) {
        return handleValidationError(
          res,
          "Last name is required and must be non-empty (max 255 characters)",
          "lastName",
          "Create system admin"
        );
      }

      // Validate email format
      if (!isValidEmail(normalizedEmail)) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Create system admin"
        );
      }

      // Validate phone if provided
      if (phone && !isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Create system admin"
        );
      }

      // Validate role - this bootstrap endpoint only seeds a predefined role
      if (role !== UserRole.ADMIN && role !== UserRole.SALES) {
        return handleValidationError(
          res,
          "Invalid role. Role must be ADMIN or SALES",
          "role",
          "Create system admin"
        );
      }

      // Check if user with this email already exists (use normalized email)
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser && !existingUser.deletedAt) {
        return handleConflictError(
          res,
          `User with email ${normalizedEmail} already exists`,
          "Create system admin"
        );
      }

      // Generate random password
      const generatedPassword = generateUserPassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);

      // Parse phone number to extract country code
      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      // Create user (store normalized email)
      // Note: this bootstrap endpoint is guarded by ADMIN_SECRET, not by a session
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone: localPhone || null,
          countryCode,
          passwordHash,
          // Emailed in plaintext, so it must be replaced on first sign-in.
          mustChangePassword: true,
          role: role as UserRole,
          region: null, // System admins don't have regions
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          countryCode: true,
          role: true,
          region: true,
          createdAt: true,
        },
      });

      // Send email with credentials (async, don't wait for it)
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      emailService
        .sendUserCreationEmail({
          name: fullName,
          email: normalizedEmail,
          password: generatedPassword,
          role: role as string,
        })
        .catch(error => {
          console.error("Failed to send user creation email:", error);
        });

      // Return user data (without password hash)
      res.status(201).json({
        ...user,
        message:
          "System admin created successfully. Login credentials have been sent to their email.",
      });
    } catch (error) {
      handleError(error, res, "Create system admin");
    }
  }
}
