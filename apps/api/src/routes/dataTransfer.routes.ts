import { Router, type Request } from "express";
import multer from "multer";

import { requireAuth } from "../middleware/auth.middleware.js";
import { DataTransferController } from "../controllers/dataTransfer.controller.js";

const controller = new DataTransferController();

/**
 * Import files are held in memory and parsed straight away — they are never
 * written to disk, so an upload cannot leave a copy of somebody's customer
 * list on the server.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  // Multer does not export its callback type in a form TypeScript can name
  // here, so the two shapes it actually accepts are spelled out.
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const ok =
      /\.(xlsx|csv)$/i.test(file.originalname) ||
      file.mimetype.includes("spreadsheet") ||
      file.mimetype.includes("csv");
    cb(ok ? null : new Error("Only .xlsx and .csv files can be imported."), ok);
  },
});

export const dataTransferRouter = Router();

// Everything here reads or writes business data, so it needs a session. The
// per-entity guards live where the entity's own module already enforces them.
dataTransferRouter.use(requireAuth);

// GET /api/data/catalogue — what can be exported and imported
dataTransferRouter.get("/catalogue", controller.catalogue.bind(controller));

// GET /api/data/:entity/export?format=xlsx|csv&startPage=&endPage=&limit=
dataTransferRouter.get(
  "/:entity/export",
  controller.exportEntity.bind(controller)
);

// GET /api/data/:entity/template — a blank workbook with the right columns
dataTransferRouter.get(
  "/:entity/template",
  controller.template.bind(controller)
);

// POST /api/data/:entity/import — multipart, field name `file`
dataTransferRouter.post(
  "/:entity/import",
  upload.single("file"),
  controller.importEntity.bind(controller)
);
