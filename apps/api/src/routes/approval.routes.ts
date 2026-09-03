import { Router } from "express";
import { ApprovalController } from "../controllers/approval.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const approvalController = new ApprovalController();

router.use(requireAuth, requirePermission("approvals.act"));

router.get("/my", approvalController.getMyApprovals.bind(approvalController));

router.get("/", approvalController.getAllApprovals.bind(approvalController));

router.get("/:id", approvalController.getApprovalById.bind(approvalController));

router.post("/", approvalController.createApproval.bind(approvalController));

router.patch(
  "/:id/action",
  approvalController.actionApproval.bind(approvalController)
);

export default router;
