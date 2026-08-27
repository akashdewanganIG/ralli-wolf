import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { LoginOtpController } from "../controllers/loginOtp.controller.js";
import { AuthMethodsController } from "../controllers/authMethods.controller.js";
import {
  requireAuth,
  requireAdminSecret,
} from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const authController = new AuthController();
const loginOtpController = new LoginOtpController();
const authMethodsController = new AuthMethodsController();
const emailRateLimitKey = (req: { body?: { email?: unknown } }) =>
  typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

// The OTP routes never see an email address, so they are throttled per
// sign-in attempt instead.
const mfaRateLimitKey = (req: { body?: { mfaToken?: unknown } }) =>
  typeof req.body?.mfaToken === "string" ? req.body.mfaToken : "";

// POST /api/auth/login
router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: emailRateLimitKey,
  }),
  authController.login
);

// Second factor. Both routes are keyed off the MFA token minted by /login,
// so neither can be reached without a verified password.
router.post(
  "/login/otp/resend",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: mfaRateLimitKey,
  }),
  (req, res) => loginOtpController.resend(req, res)
);
router.post(
  "/login/otp/verify",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: mfaRateLimitKey,
  }),
  (req, res) => loginOtpController.verify(req, res)
);

// POST /api/auth/developer-login
router.post("/developer-login", authController.developerLogin);

// POST /api/auth/logout
router.post("/logout", requireAuth, authController.logout);

// GET /api/auth/me
router.get("/me", requireAuth, authController.getCurrentUser);

// POST /api/auth/create-test-admin - Development/Testing only
router.post("/create-test-admin", authController.createTestAdmin);

// POST /api/auth/create-system-admin - Protected by ADMIN-SECRET
router.post("/create-system-admin", requireAdminSecret, (req, res) =>
  authController.createSystemAdmin(req, res)
);

// Forgot password (OTP via email)
router.post(
  "/forgot-password",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: emailRateLimitKey,
  }),
  authController.forgotPassword
);
router.post(
  "/forgot-password/verify",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: emailRateLimitKey,
  }),
  authController.verifyForgotPassword
);
router.post("/forgot-password/reset", authController.resetPassword);

// ---- Authentication method management ------------------------------------
// All behind requireAuth: these act on the signed-in account only, never on
// an id supplied by the client.
const userRateLimitKey = (req: { user?: { id?: number } }) =>
  req.user?.id ? String(req.user.id) : "";

router.get("/methods", requireAuth, (req, res) =>
  authMethodsController.list(req, res)
);
router.post("/methods/totp/setup", requireAuth, (req, res) =>
  authMethodsController.startTotpSetup(req, res)
);
router.post("/methods/totp/verify", requireAuth, (req, res) =>
  authMethodsController.verifyTotp(req, res)
);
// Sending mail is the abusable step, so it carries the tighter limit.
router.post(
  "/methods/email/send",
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: userRateLimitKey,
  }),
  (req, res) => authMethodsController.sendEmailCode(req, res)
);
// Sets a password and turns password sign-in back on.
router.post("/methods/password", requireAuth, (req, res) =>
  authMethodsController.setPassword(req, res)
);
router.post("/methods/email/verify", requireAuth, (req, res) =>
  authMethodsController.verifyEmailCode(req, res)
);
router.delete("/methods/:method", requireAuth, (req, res) =>
  authMethodsController.disable(req, res)
);

// Change password (self-service)
router.post("/change-password", requireAuth, authController.changePassword);

export default router;
