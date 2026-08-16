import { Router } from "express";
import { OpportunityController } from "../controllers/opportunity.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const opportunityController = new OpportunityController();

router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

// GET /api/opportunities - List opportunities (paginated, filterable)
router.get(
  "/",
  opportunityController.getAllOpportunities.bind(opportunityController)
);

// POST /api/opportunities - Create a new opportunity
router.post(
  "/",
  opportunityController.createOpportunity.bind(opportunityController)
);

// GET /api/opportunity/:opportunityId - Get opportunity details
router.get(
  "/:opportunityId",
  opportunityController.getOpportunityById.bind(opportunityController)
);

// PATCH /api/opportunity/:opportunityId - Update an opportunity
router.patch(
  "/:opportunityId",
  opportunityController.updateOpportunity.bind(opportunityController)
);

// DELETE /api/opportunities/:opportunityId - Delete an opportunity (soft delete)
router.delete(
  "/:opportunityId",
  opportunityController.deleteOpportunity.bind(opportunityController)
);

// POST /api/opportunities/:id/generate-quote - Generate quote from opportunity
router.post(
  "/:id/generate-quote",
  opportunityController.generateQuote.bind(opportunityController)
);

// POST /api/opportunities/:id/submit - Submit opportunity for approval (checks discount threshold)
router.post(
  "/:id/submit",
  opportunityController.submitOpportunityForApproval.bind(opportunityController)
);

/**
 * GET /api/opportunities/:opportunityId/quotes
 *
 * Returns a paginated list of all quotes belonging to a specific opportunity.
 *
 * Operations:
 *  1. Validates that opportunityId is a valid integer.
 *  2. Checks the opportunity exists and has not been soft-deleted; returns 404 if not found.
 *  3. Accepts optional query params: page (default 1) and limit (1–100, default 10).
 *  4. Fetches quotes filtered by opportunityId, ordered by createdAt DESC (newest first).
 *
 * Response shape:
 *  {
 *    data: Array<{
 *      id          : number,
 *      quoteNumber : string,       // e.g. "QUO-2602-0001-A"
 *      name        : string,
 *      status      : QuoteStatus,  // DRAFT | IN_REVIEW | APPROVED | REJECTED | PRESENTED | ACCEPTED
 *      type        : QuoteType,    // QUOTE | RENEWAL | AMENDMENT | RE_QUOTE
 *      version     : number,       // 1-based version index for this opportunity
 *      isPrimary   : boolean,      // true for the first (primary) quote
 *      grandTotal  : Decimal,
 *      createdAt   : DateTime,
 *    }>,
 *    pagination: {
 *      currentPage    : number,
 *      totalPages     : number,
 *      totalItems     : number,
 *      itemsPerPage   : number,
 *      hasNextPage    : boolean,
 *      hasPreviousPage: boolean,
 *    }
 *  }
 */
router.get(
  "/:opportunityId/quotes",
  opportunityController.getOpportunityQuotes.bind(opportunityController)
);

// GET /api/opportunities/:opportunityId/line-items - Get all line items for an opportunity
router.get(
  "/:opportunityId/line-items",
  opportunityController.getOpportunityLineItems.bind(opportunityController)
);

// POST /api/opportunities/:opportunityId/line-items - Add a line item to an opportunity
router.post(
  "/:opportunityId/line-items",
  opportunityController.addOpportunityLineItem.bind(opportunityController)
);

// PATCH /api/opportunities/:opportunityId/line-items/:lineItemId - Update a line item
router.patch(
  "/:opportunityId/line-items/:lineItemId",
  opportunityController.updateOpportunityLineItem.bind(opportunityController)
);

// DELETE /api/opportunities/:opportunityId/line-items/:lineItemId - Delete a line item (hard delete)
router.delete(
  "/:opportunityId/line-items/:lineItemId",
  opportunityController.deleteOpportunityLineItem.bind(opportunityController)
);

export default router;
