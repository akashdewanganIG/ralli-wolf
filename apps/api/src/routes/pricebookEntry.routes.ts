import { Router } from "express";
import { PriceBookEntryController } from "../controllers/pricebookEntry.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const pricebookEntryController = new PriceBookEntryController();

router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

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
