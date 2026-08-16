import { Router } from "express";
import { SubdealerController } from "../controllers/subdealer.controller.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const subdealerController = new SubdealerController();

// POST /api/subdealer/fetch-gst - Fetch GST details (unprotected)
router.post(
  "/fetch-gst",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    keyGenerator: req => String(req.body?.gstNumber || req.ip || ""),
  }),
  subdealerController.fetchGstDetails
);

// POST /api/subdealer/generate-otp - Generate and send OTP (unprotected)
router.post(
  "/generate-otp",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 OTP requests per 15 minutes per phone
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.generateOtp
);

// POST /api/subdealer/verify-otp - Verify OTP and create subdealer (unprotected)
router.post(
  "/verify-otp",
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 verification attempts per window
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.verifyOtpAndRegister
);

// POST /api/subdealer/check-phone - Check if phone number exists (unprotected)
router.post(
  "/check-phone",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.checkPhone
);

// POST /api/subdealer/login - Login existing subdealer (unprotected)
router.post(
  "/login",
  rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 login attempts per window
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.login
);

export default router;
