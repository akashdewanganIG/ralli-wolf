import { Router } from "express";
import { KeywordController } from "../controllers/keywords.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const keywordController = new KeywordController();

router.use(requireAuth, requirePermission("leads.view"));

router.get("/", keywordController.getAllKeywords.bind(keywordController));
router.get("/:id", keywordController.getKeywordById.bind(keywordController));

router.post(
  "/",
  requirePermission("leads.manage"),
  keywordController.createKeyword.bind(keywordController)
);

router.delete(
  "/:id",
  requirePermission("leads.manage"),
  keywordController.deleteKeyword.bind(keywordController)
);

export default router;
