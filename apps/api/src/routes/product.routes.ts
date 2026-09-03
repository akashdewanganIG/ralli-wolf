import { Router } from "express";
import type { Request } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { EntityImagesController } from "../controllers/entity-images.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import multer from "multer";

const router = Router();
const productController = new ProductController();
const entityImages = new EntityImagesController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    if (
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"), false);
    }
  },
});

router.get(
  "/active",
  productController.getActiveProducts.bind(productController)
);

router.use(requireAuth);
router.use(requirePermission("products.view"));

router.get("/search", productController.searchProducts.bind(productController));

router.get("/", productController.getAllProducts.bind(productController));

router.get("/:id", productController.getProductById.bind(productController));

router.post(
  "/",
  requirePermission("products.manage"),
  upload.single("image"),
  productController.createProduct.bind(productController)
);

router.put(
  "/:id",
  requirePermission("products.manage"),
  upload.single("image"),
  productController.updateProduct.bind(productController)
);

router.get(
  "/:id/images",
  entityImages.listProductImages.bind(entityImages)
);

router.post(
  "/:id/images",
  requirePermission("products.manage"),
  upload.array("images", 8),
  entityImages.addProductImages.bind(entityImages)
);

router.delete(
  "/images/:imageId",
  requirePermission("products.manage"),
  entityImages.deleteProductImage.bind(entityImages)
);

export default router;
