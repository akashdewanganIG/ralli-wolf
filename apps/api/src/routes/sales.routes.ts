import { Router } from "express";
import { salesController } from "../controllers/sales.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();

/**
 * Sales Routes
 * All routes require authentication and SALES role ONLY
 * Sales users can only access their own assigned leads
 * ADMIN  are NOT allowed on these routes
 */

// Apply authentication and SALES role requirement to all routes
router.use(requireAuth);
router.use(requireRole([UserRole.SALES]));

/**
 * GET /api/sales/leads
 * Get all leads assigned to the current sales user
 * Query params: page, limit, status, source
 */
router.get("/leads", salesController.getMyLeads);

/**
 * GET /api/sales/leads/:id
 * Get a specific lead by ID (only if assigned to this sales user)
 */
router.get("/leads/:id", salesController.getLeadById);

/**
 * PUT /api/sales/leads/:id/qualify
 * Qualify a lead (change status to QUALIFIED)
 */
router.put("/leads/:id/qualify", salesController.qualifyLead);

/**
 * PUT /api/sales/leads/:id/disqualify
 * Disqualify a lead (change status to UNQUALIFIED)
 */
router.put("/leads/:id/disqualify", salesController.disqualifyLead);

/**
 * POST /api/sales/leads/:id/remarks
 * Add a remark/note to a lead
 * Body: { remark: string }
 */
router.post("/leads/:id/remarks", salesController.addRemark);

/**
 * GET /api/sales/leads/:id/remarks
 * Get all remarks for a specific lead
 */
router.get("/leads/:id/remarks", salesController.getLeadRemarks);

/**
 * GET /api/sales/stats
 * Get statistics for the sales user's leads
 */
router.get("/stats", salesController.getMyStats);

/**
 * PUT /api/sales/enquiries/:id/resolve
 * Resolve an enquiry
 */
router.put("/enquiries/:id/resolve", salesController.resolveEnquiry);

export default router;
