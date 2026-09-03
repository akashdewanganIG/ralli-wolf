import { Router } from "express";
import { PriceBookEntryController } from "../controllers/pricebook-entry.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const pricebookEntryController = new PriceBookEntryController();

router.use(requireAuth);
router.use(requirePermission("pricebooks.manage"));

router.get(
  "/",
  pricebookEntryController.getAllPriceBookEntries.bind(pricebookEntryController)
);
router.get(
  "/:id",
  pricebookEntryController.getPriceBookEntryById.bind(pricebookEntryController)
);
router.post(
  "/",
  pricebookEntryController.createPriceBookEntry.bind(pricebookEntryController)
);
router.put(
  "/:id",
  pricebookEntryController.updatePriceBookEntry.bind(pricebookEntryController)
);
router.delete(
  "/:id",
  pricebookEntryController.deletePriceBookEntry.bind(pricebookEntryController)
);
router.get(
  "/pricebook/:priceBookId",
  pricebookEntryController.getPriceBookEntries.bind(pricebookEntryController)
);

export default router;
