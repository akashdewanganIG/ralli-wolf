import { Router } from "express";
import { SubdealerController } from "../controllers/subdealer.controller.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { requireSubdealerAuth } from "../middleware/auth.middleware.js";

const router = Router();
const subdealerController = new SubdealerController();

router.post(
  "/fetch-gst",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: req => String(req.body?.gstNumber || req.ip || ""),
  }),
  subdealerController.fetchGstDetails
);

router.post(
  "/generate-otp",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.generateOtp
);

router.post(
  "/verify-otp",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.verifyOtpAndRegister
);

router.post(
  "/login",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  subdealerController.login
);

router.post(
  "/logout",
  requireSubdealerAuth,
  subdealerController.logout.bind(subdealerController)
);

export default router;
