import { Router } from "express";
import type { Request } from "express";
import { InvoiceController } from "../controllers/invoice.controller.js";
import {
  requireAuth,
  requireRole,
  requireSubdealerAuth,
} from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";
import multer from "multer";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const invoiceController = new InvoiceController();

// Configure multer for invoice file uploads (PDFs and images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (
    _req: Request,
    file: any,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    // Accept PDF files and image files (JPEG, PNG only)
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

// Upload invoice (protected - sub-dealer auth required)
router.post(
  "/",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per 15 minutes per phone/IP
    keyGenerator: req => String(req.body?.phone || req.ip || ""),
  }),
  requireSubdealerAuth,
  upload.single("file"),
  invoiceController.uploadInvoice.bind(invoiceController)
);

// All other routes require authentication and ADMIN role
router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

// Get all invoices (ADMIN only)
router.get("/", invoiceController.getAllInvoices.bind(invoiceController));

// Get invoice by ID (ADMIN only)
router.get("/:id", invoiceController.getInvoiceById.bind(invoiceController));

// Update invoice (ADMIN only, with optional file upload)
router.put(
  "/:id",
  upload.single("file"),
  invoiceController.updateInvoice.bind(invoiceController)
);

// Delete invoice (ADMIN only)
router.delete("/:id", invoiceController.deleteInvoice.bind(invoiceController));

export default router;
