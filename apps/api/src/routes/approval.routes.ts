import { Router } from "express";
import { ApprovalController } from "../controllers/approval.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const approvalController = new ApprovalController();

router.use(requireAuth);

// GET /api/approvals/my - Get approvals for the current user (ADMIN only)
router.get(
  "/my",
  requireRole([UserRole.ADMIN]),
  approvalController.getMyApprovals.bind(approvalController)
);

// GET /api/approvals - Get all approvals in the system (ADMIN only)
router.get(
  "/",
  requireRole([UserRole.ADMIN]),
  approvalController.getAllApprovals.bind(approvalController)
);

// GET /api/approvals/:id - Get a single approval by ID
router.get(
  "/:id",
  requireRole([UserRole.ADMIN]),
  approvalController.getApprovalById.bind(approvalController)
);

// POST /api/approvals - Raise an approval request (ADMIN only)
router.post(
  "/",
  requireRole([UserRole.ADMIN]),
  approvalController.createApproval.bind(approvalController)
);

// PATCH /api/approvals/:id/action - Approve or reject (ADMIN only)
router.patch(
  "/:id/action",
  requireRole([UserRole.ADMIN]),
  approvalController.actionApproval.bind(approvalController)
);

export default router;
