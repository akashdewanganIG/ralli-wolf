import { Router } from "express";
import { ProductCategoryController } from "../controllers/product-category.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const categoryController = new ProductCategoryController();

router.get("/", categoryController.getAllCategories.bind(categoryController));

router.get("/:id", categoryController.getCategoryById.bind(categoryController));

router.use(requireAuth);
router.use(requirePermission("products.manage"));

router.post("/", categoryController.createCategory.bind(categoryController));

router.put("/:id", categoryController.updateCategory.bind(categoryController));

router.delete(
  "/:id",
  categoryController.deleteCategory.bind(categoryController)
);

export default router;
