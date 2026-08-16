import { Router } from "express";
import { ProductCategoryController } from "../controllers/productCategory.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const categoryController = new ProductCategoryController();

// Get all categories (public - for dropdowns)
router.get("/", categoryController.getAllCategories.bind(categoryController));

// Get category by ID (public)
router.get("/:id", categoryController.getCategoryById.bind(categoryController));

// All mutation routes require authentication and ADMIN role
router.use(requireAuth);
router.use(requireRole([UserRole.ADMIN]));

// Create category (admin only)
router.post("/", categoryController.createCategory.bind(categoryController));

// Update category (admin only)
router.put("/:id", categoryController.updateCategory.bind(categoryController));

// Delete category (admin only)
router.delete(
  "/:id",
  categoryController.deleteCategory.bind(categoryController)
);

export default router;
