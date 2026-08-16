import { Router } from "express";
import { PriceBookController } from "../controllers/pricebook.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const pricebookController = new PriceBookController();

router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

router.get("/", pricebookController.getAllPriceBooks.bind(pricebookController));
router.get(
  "/:id",
  pricebookController.getPriceBookById.bind(pricebookController)
);
router.post("/", pricebookController.createPriceBook.bind(pricebookController));
router.put(
  "/:id",
  pricebookController.updatePriceBook.bind(pricebookController)
);
router.delete(
  "/:id",
  pricebookController.deletePriceBook.bind(pricebookController)
);

export default router;
