import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { LoginOtpController } from "../controllers/loginOtp.controller.js";
import {
  requireAuth,
  requireAdminSecret,
} from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const authController = new AuthController();
const loginOtpController = new LoginOtpController();
const emailRateLimitKey = (req: { body?: { email?: unknown } }) =>
  typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

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

// Passwordless sign-in using a one-time code delivered by Resend.
router.post(
  "/login/otp/request",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: emailRateLimitKey,
  }),
  (req, res) => loginOtpController.request(req, res)
);
router.post(
  "/login/otp/verify",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: emailRateLimitKey,
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

// Change password (self-service)
router.post("/change-password", requireAuth, authController.changePassword);

export default router;
