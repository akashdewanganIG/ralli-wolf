import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { LoginOtpController } from "../controllers/login-otp.controller.js";
import { AuthMethodsController } from "../controllers/auth-methods.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";

const router = Router();
const authController = new AuthController();
const loginOtpController = new LoginOtpController();
const authMethodsController = new AuthMethodsController();
const emailRateLimitKey = (req: { body?: { email?: unknown } }) =>
  typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

const mfaRateLimitKey = (req: { body?: { mfaToken?: unknown } }) =>
  typeof req.body?.mfaToken === "string" ? req.body.mfaToken : "";

router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: emailRateLimitKey,
  }),
  authController.login
);

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

router.post("/logout", requireAuth, authController.logout);

router.get("/me", requireAuth, authController.getCurrentUser);

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
router.post(
  "/forgot-password/reset",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }),
  authController.resetPassword
);

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

router.post("/methods/password", requireAuth, (req, res) =>
  authMethodsController.setPassword(req, res)
);
router.post("/methods/email/verify", requireAuth, (req, res) =>
  authMethodsController.verifyEmailCode(req, res)
);
router.delete("/methods/:method", requireAuth, (req, res) =>
  authMethodsController.disable(req, res)
);

router.post("/change-password", requireAuth, authController.changePassword);

export default router;
