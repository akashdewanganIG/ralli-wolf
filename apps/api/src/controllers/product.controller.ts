import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/errorHandler.js";
import {
  uploadImageToS3,
  deleteImageFromS3,
  extractS3KeyFromUrl,
} from "../services/upload.service.js";

export class ProductController {
  /**
   * Helper: Parse and validate product ID from request params
   * Returns null if invalid (caller should handle response)
   */
  private parseProductId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, "Product ID is required", "id", operation);
      return null;
    }
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      handleValidationError(res, "Invalid product ID", "id", operation);
      return null;
    }
    return productId;
  }

  /**
   * Helper: Get product by ID with category (returns null if not found)
   */
  private async getProductByIdWithCategory(
    productId: number,
    res: Response,
    operation: string
  ): Promise<any | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      ...this.getProductIncludeOptions(),
    });

    if (!product) {
      handleNotFoundError(res, "Product", operation);
      return null;
    }

    return product;
  }

  /**
   * Helper: Validate category exists
   */
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

  /**
   * Helper: Parse boolean
   */
  private parseBoolean(active: any): boolean {
    return active === true || active === "true";
  }

  /**
   * Helper: Build search where clause
   */
  private buildSearchClause(searchTerm: string) {
    return {
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" as const } },
        { code: { contains: searchTerm, mode: "insensitive" as const } },
        { description: { contains: searchTerm, mode: "insensitive" as const } },
      ],
    };
  }

  /**
   * Helper: Upload product image to S3
   */
  private async uploadProductImage(
    file: any,
    productCode: string,
    res: Response
  ): Promise<string | undefined> {
    try {
      const uploadResult = await uploadImageToS3(
        file.buffer,
        "products",
        productCode,
        file.mimetype || "image/jpeg"
      );
      return uploadResult.secureUrl;
    } catch (uploadError) {
      handleError(uploadError, res, "Upload product image");
      return undefined;
    }
  }

  /**
   * Helper: Delete image from S3 (with error handling)
   */
  private async deleteProductImage(
    imageUrl: string | null | undefined
  ): Promise<void> {
    if (!imageUrl) return;

    const s3Key = extractS3KeyFromUrl(imageUrl);
    if (s3Key) {
      try {
        await deleteImageFromS3(s3Key);
      } catch (deleteError) {
        console.warn("Failed to delete image from S3:", deleteError);
        // Don't throw - allow operation to continue even if image deletion fails
      }
    }
    // Note: Cloudinary URLs will be handled by migration script
  }

  /**
   * Helper: Get product include options (for queries that return products)
   */
  private getProductIncludeOptions() {
    return {
      include: { category: true },
    };
  }

  /**
   * Helper: Get product query options with category and ordering (for findMany)
   */
  private getProductQueryOptions() {
    return {
      include: { category: true },
      orderBy: { createdAt: "desc" as const },
    };
  }
  /**
   * Get all products with filtering (admin only)
   * GET /api/products?categoryId=1&active=true&search=keyword
   */
  async getAllProducts(req: Request, res: Response) {
    try {
      const { categoryId, active, search } = req.query;

      // Build where clause for filtering
      const whereClause: any = {};

      // Filter by category
      if (categoryId) {
        const categoryIdNum = parseInt(categoryId as string, 10);
        if (!isNaN(categoryIdNum)) {
          whereClause.categoryId = categoryIdNum;
        }
      }

      // Filter by active status
      if (active !== undefined) {
        const activeValue =
          typeof active === "string" ? active : String(active);
        whereClause.active = activeValue === "true" || activeValue === "1";
      }

      // Search functionality
      if (search && typeof search === "string" && search.trim()) {
        Object.assign(whereClause, this.buildSearchClause(search.trim()));
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

  /**
   * Search products (admin only)
   * GET /api/products/search?q=keyword
   */
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

  /**
   * Get active products (for program 2 page - public)
   * GET /api/products/active
   */
  async getActiveProducts(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        where: { active: true },
        ...this.getProductQueryOptions(),
      });

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      handleError(error, res, "Get active products");
    }
  }

  /**
   * Get product by ID
   * GET /api/products/:id
   */
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

  /**
   * Create product (admin only)
   * POST /api/products
   */
  async createProduct(req: Request, res: Response) {
    try {
      const { name, code, description, categoryId, active, component } =
        req.body;
      const file = (req as any).file;

      // Validate required fields
      if (!name || !code || !categoryId) {
        return handleValidationError(
          res,
          "Missing required fields: name, code, and categoryId are required",
          undefined,
          "Create product"
        );
      }

      // Validate category exists
      const categoryIdNum = parseInt(categoryId, 10);
      const isValidCategory = await this.validateCategory(
        categoryIdNum,
        res,
        "Create product"
      );
      if (!isValidCategory) return;

      // Upload image if provided
      let imageUrl: string | undefined;
      if (file) {
        imageUrl = await this.uploadProductImage(file, code, res);
        if (imageUrl === undefined) return; // Error already handled in uploadProductImage
      }

      // Create product
      const product = await prisma.product.create({
        data: {
          name,
          code,
          description,
          categoryId: categoryIdNum,
          active: this.parseBoolean(active),
          component: this.parseBoolean(component),
          imageUrl,
        },
        ...this.getProductIncludeOptions(),
      });

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Create product");
        return;
      }
      handleError(error, res, "Create product");
    }
  }

  /**
   * Update product (admin only)
   * PUT /api/products/:id
   */
  async updateProduct(req: Request, res: Response) {
    try {
      const productId = this.parseProductId(
        req.params.id,
        res,
        "Update product"
      );
      if (productId === null) return;

      const { name, code, description, categoryId, active, component } =
        req.body;
      const file = (req as any).file;

      // Check if product exists
      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!existingProduct) {
        return handleNotFoundError(res, "Product", "Update product");
      }

      // Validate category if provided
      if (categoryId !== undefined) {
        const categoryIdNum = parseInt(categoryId, 10);
        const isValidCategory = await this.validateCategory(
          categoryIdNum,
          res,
          "Update product"
        );
        if (!isValidCategory) return;
      }

      // Handle image upload/update
      let imageUrl: string | undefined = existingProduct.imageUrl || undefined;
      if (file) {
        // Delete old image if exists
        await this.deleteProductImage(existingProduct.imageUrl);

        // Upload new image
        imageUrl = await this.uploadProductImage(
          file,
          code || existingProduct.code,
          res
        );
        if (imageUrl === undefined) return; // Error already handled in uploadProductImage
      }

      // Build update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;
      if (categoryId !== undefined)
        updateData.categoryId = parseInt(categoryId, 10);
      if (active !== undefined) updateData.active = this.parseBoolean(active);
      if (component !== undefined)
        updateData.component = this.parseBoolean(component);
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

      const product = await prisma.product.update({
        where: { id: productId },
        data: updateData,
        ...this.getProductIncludeOptions(),
      });

      return res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Update product");
        return;
      }
      handleError(error, res, "Update product");
    }
  }
}
