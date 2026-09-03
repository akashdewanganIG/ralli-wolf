import { Router } from "express";
import { OpportunityController } from "../controllers/opportunity.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const opportunityController = new OpportunityController();

router.use(requireAuth);
router.use(requirePermission("opportunities.view"));

router.get(
  "/",
  opportunityController.getAllOpportunities.bind(opportunityController)
);

router.post(
  "/",
  requirePermission("opportunities.manage"),
  opportunityController.createOpportunity.bind(opportunityController)
);

router.get(
  "/:opportunityId",
  opportunityController.getOpportunityById.bind(opportunityController)
);

router.patch(
  "/:opportunityId",
  requirePermission("opportunities.manage"),
  opportunityController.updateOpportunity.bind(opportunityController)
);

router.delete(
  "/:opportunityId",
  requirePermission("opportunities.manage"),
  opportunityController.deleteOpportunity.bind(opportunityController)
);

router.post(
  "/:id/generate-quote",
  requirePermission("opportunities.manage"),
  requirePermission("quotes.manage"),
  opportunityController.generateQuote.bind(opportunityController)
);

router.post(
  "/:id/submit",
  requirePermission("opportunities.manage"),
  opportunityController.submitOpportunityForApproval.bind(opportunityController)
);

router.get(
  "/:opportunityId/quotes",
  opportunityController.getOpportunityQuotes.bind(opportunityController)
);

router.get(
  "/:opportunityId/line-items",
  opportunityController.getOpportunityLineItems.bind(opportunityController)
);

router.post(
  "/:opportunityId/line-items",
  requirePermission("opportunities.manage"),
  opportunityController.addOpportunityLineItem.bind(opportunityController)
);

router.patch(
  "/:opportunityId/line-items/:lineItemId",
  requirePermission("opportunities.manage"),
  opportunityController.updateOpportunityLineItem.bind(opportunityController)
);

router.delete(
  "/:opportunityId/line-items/:lineItemId",
  requirePermission("opportunities.manage"),
  opportunityController.deleteOpportunityLineItem.bind(opportunityController)
);

export default router;
