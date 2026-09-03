import { Router, type Request } from "express";
import multer from "multer";

import { requireAuth } from "../middleware/auth.middleware.js";
import { DataTransferController } from "../controllers/data-transfer.controller.js";

const controller = new DataTransferController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },

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

dataTransferRouter.use(requireAuth);

dataTransferRouter.get("/catalogue", controller.catalogue.bind(controller));

dataTransferRouter.get(
  "/:entity/export",
  controller.exportEntity.bind(controller)
);

dataTransferRouter.get(
  "/:entity/template",
  controller.template.bind(controller)
);

dataTransferRouter.post(
  "/:entity/import",
  upload.single("file"),
  controller.importEntity.bind(controller)
);
