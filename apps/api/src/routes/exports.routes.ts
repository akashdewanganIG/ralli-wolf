import { Router } from "express";
import { ExportController } from "../controllers/export.controller.js";

const router = Router();
const controller = new ExportController();

// GET /api/export/:entity
router.get("/:entity", (req, res) => controller.exportEntityXlsx(req, res));

// POST /api/export/leads/email
router.post("/leads/email", (req, res) =>
  controller.emailSelectedLeadsXlsx(req, res)
);

export default router;
