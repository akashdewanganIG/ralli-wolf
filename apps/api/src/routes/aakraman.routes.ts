import { Router, Request, Response, NextFunction } from "express";
import {
  aakramanController,
  verifySalesUserToken,
} from "../controllers/aakraman.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * Middleware to authenticate sales user via JWT
 */
export const authenticateSalesUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Invalid token format" });
    return;
  }
  const decoded = verifySalesUserToken(token);

  if (!decoded) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as any).salesUser = decoded;
  next();
};

// Public routes - OTP generation
router.post("/send-otp/sms", (req, res) =>
  aakramanController.sendSmsOtp(req, res)
);
router.post("/send-otp/email", (req, res) =>
  aakramanController.sendEmailOtp(req, res)
);
router.post("/verify-otp", (req, res) =>
  aakramanController.verifyOtp(req, res)
);

// Protected routes - require authentication
router.get("/me", authenticateSalesUser, (req, res) =>
  aakramanController.getCurrentUser(req, res)
);

// Product routes (authenticated)
router.get("/products", authenticateSalesUser, (req, res) =>
  aakramanController.getProducts(req, res)
);

// Order routes (authenticated)
router.post("/orders", authenticateSalesUser, (req, res) =>
  aakramanController.createOrder(req, res)
);
router.get("/orders", authenticateSalesUser, (req, res) =>
  aakramanController.getMyOrders(req, res)
);

// Admin routes - require admin/system_admin authentication
router.get("/admin/orders", requireAuth, requireRole(["ADMIN"]), (req, res) =>
  aakramanController.getAllOrders(req, res)
);
router.get(
  "/admin/orders/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  (req, res) => aakramanController.getOrderById(req, res)
);
router.put(
  "/admin/orders/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  (req, res) => aakramanController.updateOrder(req, res)
);
router.post(
  "/admin/orders/:id/archive",
  requireAuth,
  requireRole(["ADMIN"]),
  (req, res) => aakramanController.archiveOrder(req, res)
);
router.post(
  "/admin/orders/:id/unarchive",
  requireAuth,
  requireRole(["ADMIN"]),
  (req, res) => aakramanController.unarchiveOrder(req, res)
);
router.get(
  "/admin/sales-users",
  requireAuth,
  requireRole(["ADMIN"]),
  (req, res) => aakramanController.getSalesUsers(req, res)
);

export default router;
