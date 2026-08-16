import { Router } from "express";
import type { Request } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";
import multer from "multer";

const router = Router();
const productController = new ProductController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (
    _req: Request,
    file: any,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Get active products (public - for program 2 page)
router.get(
  "/active",
  productController.getActiveProducts.bind(productController)
);

// All other routes require authentication
router.use(requireAuth);

// Search products (admin only)
router.get(
  "/search",
  requireRole([UserRole.ADMIN]),
  productController.searchProducts.bind(productController)
);

// Get all products with filters (admin only)
router.get(
  "/",
  requireRole([UserRole.ADMIN]),
  productController.getAllProducts.bind(productController)
);

// Get product by ID
router.get(
  "/:id",
  requireRole([UserRole.ADMIN]),
  productController.getProductById.bind(productController)
);

// Create product (admin only, with image upload)
router.post(
  "/",
  requireRole([UserRole.ADMIN]),
  upload.single("image"),
  productController.createProduct.bind(productController)
);

// Update product (admin only, with optional image upload)
router.put(
  "/:id",
  requireRole([UserRole.ADMIN]),
  upload.single("image"),
  productController.updateProduct.bind(productController)
);

export default router;
