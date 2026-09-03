import { Router } from "express";
import { ExportController } from "../controllers/export.controller.js";
import type { NextFunction, Request, Response } from "express";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const controller = new ExportController();

router.use(requireAuth, requirePermission("reports.export"));

function requireExportDataset(req: Request, res: Response, next: NextFunction) {
  const entity = String(req.params.entity ?? "");
  if (entity === "leads") {
    return requirePermission("leads.view")(req, res, next);
  }
  if (entity === "contacts" || entity === "accounts") {
    return requirePermission("accounts.view")(req, res, next);
  }
  next();
}

router.get("/:entity", requireExportDataset, (req, res) =>
  controller.exportEntityXlsx(req, res)
);

router.post("/leads/email", requirePermission("leads.view"), (req, res) =>
  controller.emailSelectedLeadsXlsx(req, res)
);

export default router;
