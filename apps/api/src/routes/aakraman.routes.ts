import { Router, Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "@repo/db";
import { aakramanController } from "../controllers/aakraman.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import { verifyAakramanToken } from "../utils/jwt.utils.js";
import { rateLimit } from "../middleware/rate-limit.js";

const router = Router();

export const authenticateSalesUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void authenticateSalesUserRequest(req, res, next);
};

async function authenticateSalesUserRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
  let decoded;
  try {
    decoded = verifyAakramanToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        deletedAt: null,
        role: { in: [UserRole.SALES, UserRole.ADMIN] },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        sessionVersion: true,
      },
    });

    if (
      !user ||
      user.sessionVersion !== decoded.sessionVersion ||
      user.email !== decoded.email ||
      (user.phone || "") !== decoded.phone
    ) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.salesUser = {
      userId: user.id,
      phone: user.phone || "",
      email: user.email,
      type: "sales_user",
    };
    next();
  } catch (error) {
    next(error);
  }
}

const otpSendLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: req =>
    String(req.body?.phone || req.body?.email || "")
      .trim()
      .toLowerCase(),
});
const otpVerifyLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: req =>
    String(req.body?.phone || req.body?.email || "")
      .trim()
      .toLowerCase(),
});

router.post("/send-otp/sms", otpSendLimit, (req, res) =>
  aakramanController.sendSmsOtp(req, res)
);
router.post("/send-otp/email", otpSendLimit, (req, res) =>
  aakramanController.sendEmailOtp(req, res)
);
router.post("/verify-otp", otpVerifyLimit, (req, res) =>
  aakramanController.verifyOtp(req, res)
);

router.get("/me", authenticateSalesUser, (req, res) =>
  aakramanController.getCurrentUser(req, res)
);

router.get("/products", authenticateSalesUser, (req, res) =>
  aakramanController.getProducts(req, res)
);

router.post("/orders", authenticateSalesUser, (req, res) =>
  aakramanController.createOrder(req, res)
);
router.get("/orders", authenticateSalesUser, (req, res) =>
  aakramanController.getMyOrders(req, res)
);

router.get(
  "/admin/orders",
  requireAuth,
  requirePermission("salesOrders.view"),
  (req, res) => aakramanController.getAllOrders(req, res)
);
router.get(
  "/admin/orders/:id",
  requireAuth,
  requirePermission("salesOrders.view"),
  (req, res) => aakramanController.getOrderById(req, res)
);
router.put(
  "/admin/orders/:id",
  requireAuth,
  requirePermission("salesOrders.manage"),
  (req, res) => aakramanController.updateOrder(req, res)
);
router.post(
  "/admin/orders/:id/archive",
  requireAuth,
  requirePermission("salesOrders.manage"),
  (req, res) => aakramanController.archiveOrder(req, res)
);
router.post(
  "/admin/orders/:id/unarchive",
  requireAuth,
  requirePermission("salesOrders.manage"),
  (req, res) => aakramanController.unarchiveOrder(req, res)
);
router.get(
  "/admin/sales-users",
  requireAuth,
  requirePermission("users.manage"),
  (req, res) => aakramanController.getSalesUsers(req, res)
);

export default router;
