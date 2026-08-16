import { Router } from "express";
import { KeywordController } from "../controllers/keywords.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const keywordController = new KeywordController();

// Require authentication for all keyword routes
router.use(requireAuth);

// GET routes
router.get("/", keywordController.getAllKeywords.bind(keywordController));
router.get("/:id", keywordController.getKeywordById.bind(keywordController));

// POST routes
router.post("/", keywordController.createKeyword.bind(keywordController));

// DELETE routes
router.delete("/:id", keywordController.deleteKeyword.bind(keywordController));

export default router;
