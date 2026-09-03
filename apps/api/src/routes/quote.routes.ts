import { Router } from "express";
import { QuoteController } from "../controllers/quote.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const quoteController = new QuoteController();

router.use(requireAuth);
router.use(requirePermission("quotes.view"));

router.get("/", quoteController.getAllQuotes.bind(quoteController));

router.get(
  "/:id/line-items",
  quoteController.getQuoteLineItems.bind(quoteController)
);

router.get("/:id/orders", quoteController.getQuoteOrders.bind(quoteController));

router.get("/:id/pdf", quoteController.generatePdf.bind(quoteController));

router.get("/:id", quoteController.getQuoteById.bind(quoteController));

router.post(
  "/:id/submit-for-approval",
  requirePermission("quotes.manage"),
  quoteController.submitForApproval.bind(quoteController)
);

router.post(
  "/:id/send",
  requirePermission("quotes.manage"),
  quoteController.sendToClient.bind(quoteController)
);

router.post(
  "/:id/generate-order",
  requirePermission("quotes.manage"),
  requirePermission("salesOrders.manage"),
  quoteController.generateOrder.bind(quoteController)
);

router.patch(
  "/:id",
  requirePermission("quotes.manage"),
  quoteController.updateQuoteStatus.bind(quoteController)
);

router.patch(
  "/:id/set-primary",
  requirePermission("quotes.manage"),
  quoteController.setPrimaryQuote.bind(quoteController)
);

export default router;
