import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/error-handler.js";
import {
  uploadImageToS3,
  deleteImageFromS3,
  extractS3KeyFromUrl,
  type UploadResult,
} from "../services/upload.service.js";
import { getOrderCatalogueProducts } from "../services/order-pricing.service.js";
import { verifyFileContent } from "../utils/file-validation.js";
import { logError } from "../utils/logger.js";

const PRODUCT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const CRM_PRODUCT_SELECT = {
  id: true,
  name: true,
  code: true,
  imageUrl: true,
  description: true,
  categoryId: true,
  active: true,
  component: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

export class ProductController {
  private parseProductId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, "Product ID is required", "id", operation);
      return null;
    }
    const productId = Number(id);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      handleValidationError(res, "Invalid product ID", "id", operation);
      return null;
    }
    return productId;
  }

  private async getProductByIdWithCategory(
    productId: number,
    res: Response,
    operation: string
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: CRM_PRODUCT_SELECT,
    });

    if (!product) {
      handleNotFoundError(res, "Product", operation);
      return null;
    }

    return product;
  }

  private async validateCategory(
    categoryId: number,
    res: Response,
    operation: string
  ): Promise<boolean> {
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      handleNotFoundError(res, "Category", operation);
      return false;
    }
    return true;
  }

  private parseBoolean(value: unknown): boolean | undefined | null {
    if (value === undefined) return undefined;
    if (value === true || value === "true" || value === "1") return true;
    if (value === false || value === "false" || value === "0") return false;
    return null;
  }

  private buildSearchClause(searchTerm: string) {
    return {
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" as const } },
        { code: { contains: searchTerm, mode: "insensitive" as const } },
        { description: { contains: searchTerm, mode: "insensitive" as const } },
      ],
    };
  }

  private async uploadProductImage(
    file: Express.Multer.File,
    productCode: string,
    res: Response
  ): Promise<UploadResult | undefined> {
    const verified = verifyFileContent(
      file.buffer,
      file.mimetype,
      PRODUCT_IMAGE_MIME_TYPES
    );
    if (!verified) {
      handleValidationError(
        res,
        "Image content must be a valid JPEG, PNG, or WebP file",
        "image",
        "Upload product image"
      );
      return undefined;
    }

    try {
      return await uploadImageToS3(
        file.buffer,
        "products",
        productCode,
        verified.mimeType
      );
    } catch (uploadError) {
      handleError(uploadError, res, "Upload product image");
      return undefined;
    }
  }

  private async deleteProductImage(
    imageUrl: string | null | undefined
  ): Promise<void> {
    if (!imageUrl) return;

    const s3Key = extractS3KeyFromUrl(imageUrl);
    if (s3Key) {
      try {
        await deleteImageFromS3(s3Key);
      } catch (deleteError) {
        logError("product_image_cleanup_failed", deleteError);
      }
    }
  }

  private getProductQueryOptions() {
    return {
      select: CRM_PRODUCT_SELECT,
      orderBy: { createdAt: "desc" as const },
    };
  }

  async getAllProducts(req: Request, res: Response) {
    try {
      const { categoryId, active, search } = req.query;

      const whereClause: Prisma.ProductWhereInput = {};

      if (categoryId) {
        const categoryIdNum = Number(categoryId);
        if (!Number.isSafeInteger(categoryIdNum) || categoryIdNum <= 0) {
          return handleValidationError(
            res,
            "Invalid category ID",
            "categoryId",
            "Get all products"
          );
        }
        whereClause.categoryId = categoryIdNum;
      }

      if (active !== undefined) {
        const activeValue = this.parseBoolean(active);
        if (activeValue === null || activeValue === undefined) {
          return handleValidationError(
            res,
            "active must be true or false",
            "active",
            "Get all products"
          );
        }
        whereClause.active = activeValue;
      }

      if (search && typeof search === "string" && search.trim()) {
        const searchTerm = search.trim();
        if (searchTerm.length > 200) {
          return handleValidationError(
            res,
            "Search query cannot exceed 200 characters",
            "search",
            "Get all products"
          );
        }
        Object.assign(whereClause, this.buildSearchClause(searchTerm));
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        ...this.getProductQueryOptions(),
      });

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      handleError(error, res, "Get all products");
    }
  }

  async searchProducts(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string" || !q.trim()) {
        return handleValidationError(
          res,
          "Search query is required",
          "q",
          "Search products"
        );
      }

      const searchTerm = q.trim();
      if (searchTerm.length > 200) {
        return handleValidationError(
          res,
          "Search query cannot exceed 200 characters",
          "q",
          "Search products"
        );
      }

      const products = await prisma.product.findMany({
        where: this.buildSearchClause(searchTerm),
        ...this.getProductQueryOptions(),
      });

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      handleError(error, res, "Search products");
    }
  }

  async getActiveProducts(req: Request, res: Response) {
    try {
      const products = await getOrderCatalogueProducts();

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      handleError(error, res, "Get active products");
    }
  }

  async getProductById(req: Request, res: Response) {
    try {
      const productId = this.parseProductId(req.params.id, res, "Get product");
      if (productId === null) return;

      const product = await this.getProductByIdWithCategory(
        productId,
        res,
        "Get product"
      );
      if (!product) return;

      return res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      handleError(error, res, "Get product");
    }
  }

  async createProduct(req: Request, res: Response) {
    let uploadedImage: UploadResult | undefined;
    try {
      const { name, code, description, categoryId, active, component } =
        req.body;
      const file = req.file;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 200 ||
        typeof code !== "string" ||
        !code.trim() ||
        code.trim().length > 80 ||
        categoryId === undefined
      ) {
        return handleValidationError(
          res,
          "name (max 200 characters), code (max 80 characters), and categoryId are required",
          undefined,
          "Create product"
        );
      }

      if (description !== undefined && typeof description !== "string") {
        return handleValidationError(
          res,
          "description must be text",
          "description",
          "Create product"
        );
      }
      const normalizedDescription = description?.trim() || undefined;
      if (normalizedDescription && normalizedDescription.length > 4000) {
        return handleValidationError(
          res,
          "description cannot exceed 4000 characters",
          "description",
          "Create product"
        );
      }

      const categoryIdNum = Number(categoryId);
      if (!Number.isSafeInteger(categoryIdNum) || categoryIdNum <= 0) {
        return handleValidationError(
          res,
          "Invalid category ID",
          "categoryId",
          "Create product"
        );
      }
      const isValidCategory = await this.validateCategory(
        categoryIdNum,
        res,
        "Create product"
      );
      if (!isValidCategory) return;

      const activeValue = this.parseBoolean(active);
      const componentValue = this.parseBoolean(component);
      if (activeValue === null || componentValue === null) {
        return handleValidationError(
          res,
          "active and component must be true or false",
          undefined,
          "Create product"
        );
      }

      if (file) {
        uploadedImage = await this.uploadProductImage(file, code.trim(), res);
        if (!uploadedImage) return;
      }

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          code: code.trim(),
          description: normalizedDescription,
          categoryId: categoryIdNum,
          active: activeValue ?? false,
          component: componentValue ?? false,
          imageUrl: uploadedImage?.secureUrl,
        },
        select: CRM_PRODUCT_SELECT,
      });
      uploadedImage = undefined;

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      if (uploadedImage) {
        try {
          await deleteImageFromS3(uploadedImage.publicId);
        } catch (cleanupError) {
          logError("unpersisted_product_image_cleanup_failed", cleanupError);
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Create product");
        return;
      }
      handleError(error, res, "Create product");
    }
  }

  async updateProduct(req: Request, res: Response) {
    let uploadedImage: UploadResult | undefined;
    try {
      const productId = this.parseProductId(
        req.params.id,
        res,
        "Update product"
      );
      if (productId === null) return;

      const { name, code, description, categoryId, active, component } =
        req.body;
      const file = req.file;

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!existingProduct) {
        return handleNotFoundError(res, "Product", "Update product");
      }

      if (categoryId !== undefined) {
        const categoryIdNum = Number(categoryId);
        if (!Number.isSafeInteger(categoryIdNum) || categoryIdNum <= 0) {
          return handleValidationError(
            res,
            "Invalid category ID",
            "categoryId",
            "Update product"
          );
        }
        const isValidCategory = await this.validateCategory(
          categoryIdNum,
          res,
          "Update product"
        );
        if (!isValidCategory) return;
      }

      const updateData: Prisma.ProductUncheckedUpdateInput = {};
      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.trim().length > 200
        ) {
          return handleValidationError(
            res,
            "name must be between 1 and 200 characters",
            "name",
            "Update product"
          );
        }
        updateData.name = name.trim();
      }
      if (code !== undefined) {
        if (
          typeof code !== "string" ||
          !code.trim() ||
          code.trim().length > 80
        ) {
          return handleValidationError(
            res,
            "code must be between 1 and 80 characters",
            "code",
            "Update product"
          );
        }
        updateData.code = code.trim();
      }
      if (description !== undefined) {
        if (
          typeof description !== "string" ||
          description.trim().length > 4000
        ) {
          return handleValidationError(
            res,
            "description must be text no longer than 4000 characters",
            "description",
            "Update product"
          );
        }
        updateData.description = description.trim() || null;
      }
      if (categoryId !== undefined) updateData.categoryId = Number(categoryId);
      if (active !== undefined) {
        const value = this.parseBoolean(active);
        if (value === null || value === undefined) {
          return handleValidationError(
            res,
            "active must be true or false",
            "active",
            "Update product"
          );
        }
        updateData.active = value;
      }
      if (component !== undefined) {
        const value = this.parseBoolean(component);
        if (value === null || value === undefined) {
          return handleValidationError(
            res,
            "component must be true or false",
            "component",
            "Update product"
          );
        }
        updateData.component = value;
      }

      if (file) {
        uploadedImage = await this.uploadProductImage(
          file,
          typeof code === "string" && code.trim()
            ? code.trim()
            : existingProduct.code,
          res
        );
        if (!uploadedImage) return;
      }
      if (uploadedImage) updateData.imageUrl = uploadedImage.secureUrl;

      const product = await prisma.product.update({
        where: { id: productId },
        data: updateData,
        select: CRM_PRODUCT_SELECT,
      });
      uploadedImage = undefined;

      if (file) {
        await this.deleteProductImage(existingProduct.imageUrl);
      }

      return res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      if (uploadedImage) {
        try {
          await deleteImageFromS3(uploadedImage.publicId);
        } catch (cleanupError) {
          logError("unpersisted_product_image_cleanup_failed", cleanupError);
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Update product");
        return;
      }
      handleError(error, res, "Update product");
    }
  }
}
