import { Router } from "express";
import { QuoteController } from "../controllers/quote.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const quoteController = new QuoteController();

router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

// GET /api/quotes - List all quotes (paginated, filterable)
router.get("/", quoteController.getAllQuotes.bind(quoteController));

// GET /api/quotes/:id/line-items - Get line items for a quote (paginated)
router.get(
  "/:id/line-items",
  quoteController.getQuoteLineItems.bind(quoteController)
);

// GET /api/quotes/:id/orders - Get all orders for a quote (paginated)
router.get("/:id/orders", quoteController.getQuoteOrders.bind(quoteController));

// GET /api/quotes/:id/pdf - Generate quote PDF
router.get("/:id/pdf", quoteController.generatePdf.bind(quoteController));

// GET /api/quotes/:id - Get single quote by quote ID (detail page)
router.get("/:id", quoteController.getQuoteById.bind(quoteController));

// POST /api/quotes/:id/submit-for-approval - Submit quote for internal approval (ADMIN only)
router.post(
  "/:id/submit-for-approval",
  quoteController.submitForApproval.bind(quoteController)
);

// POST /api/quotes/:id/send - Send approved quote to client via email (ADMIN only)
router.post("/:id/send", quoteController.sendToClient.bind(quoteController));

// POST /api/quotes/:id/generate-order - Generate sales order from accepted quote (ADMIN only)
router.post(
  "/:id/generate-order",
  quoteController.generateOrder.bind(quoteController)
);

// PATCH /api/quotes/:id - Update quote status (ADMIN only)
router.patch("/:id", quoteController.updateQuoteStatus.bind(quoteController));

// PATCH /api/quotes/:id/set-primary - Set quote as primary (ADMIN only)
router.patch(
  "/:id/set-primary",
  quoteController.setPrimaryQuote.bind(quoteController)
);

export default router;
