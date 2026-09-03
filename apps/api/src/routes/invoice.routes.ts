import { Router } from "express";
import type { Request } from "express";
import { InvoiceController } from "../controllers/invoice.controller.js";
import {
  requireAuth,
  requirePermission,
  requireSubdealerAuth,
} from "../middleware/auth.middleware.js";
import multer from "multer";
import { rateLimit } from "../middleware/rate-limit.js";

const router = Router();
const invoiceController = new InvoiceController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image files (JPEG, PNG) are allowed"), false);
    }
  },
});

router.post(
  "/",
  requireSubdealerAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: req => String(req.subdealer?.id || req.ip || ""),
  }),
  upload.single("file"),
  invoiceController.uploadInvoice.bind(invoiceController)
);

router.use(requireAuth);
router.use(requirePermission("finance.view"));

router.get("/", invoiceController.getAllInvoices.bind(invoiceController));

router.get(
  "/:id/file",
  invoiceController.downloadInvoiceFile.bind(invoiceController)
);

router.get("/:id", invoiceController.getInvoiceById.bind(invoiceController));

router.put(
  "/:id",
  requirePermission("finance.manage"),
  upload.single("file"),
  invoiceController.updateInvoice.bind(invoiceController)
);

router.delete(
  "/:id",
  requirePermission("finance.manage"),
  invoiceController.deleteInvoice.bind(invoiceController)
);

export default router;
