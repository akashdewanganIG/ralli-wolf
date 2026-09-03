import { Router } from "express";
import { LeadController } from "../controllers/leads.controller.js";
import multer from "multer";
import { LeadsImportController } from "../controllers/leads-import.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const leadController = new LeadController();
const leadsImportController = new LeadsImportController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

router.use(requireAuth);
router.use(requirePermission("leads.view"));

router.get("/", leadController.getAllLeads.bind(leadController));
router.get(
  "/assignment/stats",
  requirePermission("leads.manage"),
  leadController.getAssignmentStats.bind(leadController)
);
router.get("/search", leadController.searchLeads.bind(leadController));

router.get("/import/template", requirePermission("data.import"), (req, res) =>
  leadsImportController.downloadTemplate(req, res)
);
router.get(
  "/import/template-csv",
  requirePermission("data.import"),
  (req, res) => leadsImportController.downloadTemplateCsv(req, res)
);
router.post(
  "/import",
  requirePermission("data.import"),
  requirePermission("leads.manage"),
  upload.single("file"),
  (req, res) => leadsImportController.importLeads(req, res)
);

router.get("/:id", leadController.getLeadById.bind(leadController));
router.get(
  "/:id/conversion-history",
  leadController.getConversionHistory.bind(leadController)
);
router.get(
  "/:id/form-submissions",
  leadController.getFormSubmissionsByLead.bind(leadController)
);

router.post(
  "/",
  requirePermission("leads.manage"),
  leadController.createLead.bind(leadController)
);
router.put(
  "/:id",
  requirePermission("leads.manage"),
  leadController.updateLead.bind(leadController)
);
router.delete(
  "/:id",
  requirePermission("leads.manage"),
  leadController.deleteLead.bind(leadController)
);
router.post(
  "/:id/convert",
  requirePermission("leads.manage"),
  leadController.convertLeadToContact.bind(leadController)
);
router.post(
  "/convert-bulk",
  requirePermission("leads.manage"),
  leadController.convertLeadsBulk.bind(leadController)
);
router.put(
  "/:id/assign",
  requirePermission("leads.manage"),
  leadController.assignLeadToUser.bind(leadController)
);
router.post(
  "/assign-bulk",
  requirePermission("leads.manage"),
  leadController.assignLeadsBulkToUser.bind(leadController)
);

router.put(
  "/:id/claim",
  requirePermission("leads.manage"),
  leadController.claimLead.bind(leadController)
);
router.post(
  "/claim-bulk",
  requirePermission("leads.manage"),
  leadController.claimLeadsBulk.bind(leadController)
);
export default router;
