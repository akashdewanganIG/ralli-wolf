import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/error-handler.js";

export class ProductCategoryController {
  private parseCategoryId(
    value: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      handleValidationError(res, "Invalid category ID", "id", operation);
      return null;
    }
    return id;
  }

  async getAllCategories(_req: Request, res: Response) {
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

  async getCategoryById(req: Request, res: Response) {
    try {
      const categoryId = this.parseCategoryId(
        req.params.id,
        res,
        "Get category"
      );
      if (categoryId === null) return;

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

  async createCategory(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 120
      ) {
        return handleValidationError(
          res,
          "Category name must be between 1 and 120 characters",
          "name",
          "Create category"
        );
      }
      if (description !== undefined && typeof description !== "string") {
        return handleValidationError(
          res,
          "Description must be text",
          "description",
          "Create category"
        );
      }
      const normalizedDescription = description?.trim() || undefined;
      if (normalizedDescription && normalizedDescription.length > 2000) {
        return handleValidationError(
          res,
          "Description cannot exceed 2000 characters",
          "description",
          "Create category"
        );
      }

      const category = await prisma.productCategory.create({
        data: {
          name: name.trim(),
          description: normalizedDescription,
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

  async updateCategory(req: Request, res: Response) {
    try {
      const categoryId = this.parseCategoryId(
        req.params.id,
        res,
        "Update category"
      );
      if (categoryId === null) return;
      const { name, description } = req.body;

      if (name === undefined && description === undefined) {
        return handleValidationError(
          res,
          "At least one category field is required",
          undefined,
          "Update category"
        );
      }

      const existingCategory = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return handleNotFoundError(res, "Category", "Update category");
      }

      const updateData: Prisma.ProductCategoryUpdateInput = {};
      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.trim().length > 120
        ) {
          return handleValidationError(
            res,
            "Category name must be between 1 and 120 characters",
            "name",
            "Update category"
          );
        }
        updateData.name = name.trim();
      }
      if (description !== undefined) {
        if (
          typeof description !== "string" ||
          description.trim().length > 2000
        ) {
          return handleValidationError(
            res,
            "Description must be text no longer than 2000 characters",
            "description",
            "Update category"
          );
        }
        updateData.description = description.trim() || null;
      }

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

  async deleteCategory(req: Request, res: Response) {
    try {
      const categoryId = this.parseCategoryId(
        req.params.id,
        res,
        "Delete category"
      );
      if (categoryId === null) return;

      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId },
        select: {
          id: true,
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        return handleNotFoundError(res, "Category", "Delete category");
      }

      if (category._count.products > 0) {
        return handleValidationError(
          res,
          "Cannot delete category with associated products",
          "categoryId",
          "Delete category"
        );
      }

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
