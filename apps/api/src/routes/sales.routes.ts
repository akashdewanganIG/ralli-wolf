import { Router } from "express";
import { salesController } from "../controllers/sales.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("leads.view"));

router.get("/leads", salesController.getMyLeads);

router.get("/leads/:id", salesController.getLeadById);

router.put(
  "/leads/:id/qualify",
  requirePermission("leads.manage"),
  salesController.qualifyLead
);

router.put(
  "/leads/:id/disqualify",
  requirePermission("leads.manage"),
  salesController.disqualifyLead
);

router.post(
  "/leads/:id/remarks",
  requirePermission("leads.manage"),
  salesController.addRemark
);

router.get("/leads/:id/remarks", salesController.getLeadRemarks);

router.get("/stats", salesController.getMyStats);

router.put(
  "/enquiries/:id/resolve",
  requirePermission("leads.manage"),
  salesController.resolveEnquiry
);

export default router;
