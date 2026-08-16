import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/errorHandler.js";

export class ProductCategoryController {
  /**
   * Get all categories
   * GET /api/product-categories
   */
  async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.productCategory.findMany({
        orderBy: {
          name: "asc",
        },
      });

      return res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      handleError(error, res, "Get all categories");
    }
  }

  /**
   * Get category by ID
   * GET /api/product-categories/:id
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Category ID is required",
          "id",
          "Get category"
        );
      }
      const categoryId = parseInt(id, 10);

      if (isNaN(categoryId)) {
        return handleValidationError(
          res,
          "Invalid category ID",
          "id",
          "Get category"
        );
      }

      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return handleNotFoundError(res, "Category", "Get category");
      }

      return res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      handleError(error, res, "Get category");
    }
  }

  /**
   * Create category (admin only)
   * POST /api/product-categories
   */
  async createCategory(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return handleValidationError(
          res,
          "Category name is required",
          "name",
          "Create category"
        );
      }

      const category = await prisma.productCategory.create({
        data: {
          name,
          description,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Create category");
        return;
      }
      handleError(error, res, "Create category");
    }
  }

  /**
   * Update category (admin only)
   * PUT /api/product-categories/:id
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Category ID is required",
          "id",
          "Update category"
        );
      }
      const categoryId = parseInt(id, 10);
      const { name, description } = req.body;

      if (isNaN(categoryId)) {
        return handleValidationError(
          res,
          "Invalid category ID",
          "id",
          "Update category"
        );
      }

      // Check if category exists
      const existingCategory = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return handleNotFoundError(res, "Category", "Update category");
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const category = await prisma.productCategory.update({
        where: { id: categoryId },
        data: updateData,
      });

      return res.json({
        success: true,
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Update category");
        return;
      }
      handleError(error, res, "Update category");
    }
  }

  /**
   * Delete category (admin only)
   * DELETE /api/product-categories/:id
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Category ID is required",
          "id",
          "Delete category"
        );
      }
      const categoryId = parseInt(id, 10);

      if (isNaN(categoryId)) {
        return handleValidationError(
          res,
          "Invalid category ID",
          "id",
          "Delete category"
        );
      }

      // Check if category exists
      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId },
        include: {
          products: true,
        },
      });

      if (!category) {
        return handleNotFoundError(res, "Category", "Delete category");
      }

      // Check if category has products
      if (category.products.length > 0) {
        return handleValidationError(
          res,
          "Cannot delete category with associated products",
          "categoryId",
          "Delete category"
        );
      }

      // Delete category
      await prisma.productCategory.delete({
        where: { id: categoryId },
      });

      return res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      handleError(error, res, "Delete category");
    }
  }
}
