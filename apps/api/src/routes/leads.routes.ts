import { Router } from "express";
import { LeadController } from "../controllers/leads.controller.js";
import multer from "multer";
import { LeadsImportController } from "../controllers/leadsImport.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const leadController = new LeadController();
const leadsImportController = new LeadsImportController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Require authentication for all lead routes
router.use(requireAuth);

// GET routes (logic for role handled in controller)
router.get("/", leadController.getAllLeads.bind(leadController));
router.get("/all", leadController.getAllLeadsComplete.bind(leadController));
router.get(
  "/assignment/stats",
  requireRole([UserRole.ADMIN]),
  leadController.getAssignmentStats.bind(leadController)
);
router.get("/filter", leadController.filterLeads.bind(leadController));
router.get(
  "/by-status/:status",
  leadController.getLeadsByStatus.bind(leadController)
);
router.get(
  "/by-source/:source",
  leadController.getLeadsBySource.bind(leadController)
);
router.get(
  "/by-owner/:ownerId",
  leadController.getLeadsByOwner.bind(leadController)
);
router.get("/by-score", leadController.getLeadsByScore.bind(leadController));
router.get("/search", leadController.searchLeads.bind(leadController));
router.get("/:id", leadController.getLeadById.bind(leadController));
router.get(
  "/:id/conversion-history",
  leadController.getConversionHistory.bind(leadController)
);
router.get(
  "/:id/form-submissions",
  leadController.getFormSubmissionsByLead.bind(leadController)
);

// Lead conversion and assignment - only admin/system admin
router.post(
  "/",
  requireRole([UserRole.ADMIN]),
  leadController.createLead.bind(leadController)
);
router.put(
  "/:id",
  requireRole([UserRole.ADMIN]),
  leadController.updateLead.bind(leadController)
);
router.delete(
  "/:id",
  requireRole([UserRole.ADMIN]),
  leadController.deleteLead.bind(leadController)
);
router.post(
  "/:id/convert",
  requireRole([UserRole.ADMIN]),
  leadController.convertLeadToContact.bind(leadController)
);
router.post(
  "/convert-bulk",
  requireRole([UserRole.ADMIN]),
  leadController.convertLeadsBulk.bind(leadController)
);
router.put(
  "/:id/assign",
  requireRole([UserRole.ADMIN]),
  leadController.assignLeadToUser.bind(leadController)
);
router.post(
  "/assign-bulk",
  requireRole([UserRole.ADMIN]),
  leadController.assignLeadsBulkToUser.bind(leadController)
);
// Lead claim - allow any authenticated user (logic in controller for role)
router.put("/:id/claim", leadController.claimLead.bind(leadController));
router.post("/claim-bulk", leadController.claimLeadsBulk.bind(leadController));
router.put(
  "/:id/score",
  requireRole([UserRole.ADMIN]),
  leadController.updateLeadScore.bind(leadController)
);

// Import/Template routes (leads only)
router.get("/import/template", (req, res) =>
  leadsImportController.downloadTemplate(req, res)
);
router.get("/import/template-csv", (req, res) =>
  leadsImportController.downloadTemplateCsv(req, res)
);
router.post(
  "/import",
  requireRole([UserRole.ADMIN]),
  upload.single("file"),
  (req, res) => leadsImportController.importLeads(req, res)
);

export default router;
