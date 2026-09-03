import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { NotFoundError, DomainError } from "../services/supplyChain/errors.js";
import {
  assertImageLimit,
  cleanupEntityImages,
  requireImageFiles,
  uploadEntityImages,
} from "../services/entityImages.service.js";
import {
  handleSupplyChainError,
  optionalString,
  parseId,
  parseOptionalId,
} from "../utils/supply-chain-http.js";

const PRODUCT_IMAGE_LIMIT = 8;
const RECEIPT_IMAGE_LIMIT = 12;
const QUALITY_CHECK_IMAGE_LIMIT = 12;

export class EntityImagesController {
  private files(req: Request): Express.Multer.File[] {
    return Array.isArray(req.files) ? req.files : [];
  }

  /**
   * Products keep the legacy single `imageUrl` column in sync with the first
   * gallery image, so existing readers (CRM product lists, order catalogue,
   * subdealer forms) keep working unchanged.
   */
  private async syncProductPrimaryImage(productId: number) {
    const primary = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl: primary?.url ?? null },
    });
  }

  async listProductImages(req: Request, res: Response) {
    try {
      const productId = parseId(req.params.id, "Product id");
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundError("Product");

      const images = await prisma.productImage.findMany({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.json({ data: images });
    } catch (error) {
      handleSupplyChainError(error, res, "List product images");
    }
  }

  async addProductImages(req: Request, res: Response) {
    const operation = "Add product images";
    let uploaded: Array<{ url: string; sortOrder: number }> = [];
    let persisted = false;

    try {
      const productId = parseId(req.params.id, "Product id");
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, code: true, _count: { select: { images: true } } },
      });
      if (!product) throw new NotFoundError("Product");

      const files = requireImageFiles(this.files(req));
      assertImageLimit(
        product._count.images,
        files.length,
        PRODUCT_IMAGE_LIMIT,
        "product"
      );

      const last = await prisma.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
      });
      const startAt = (last._max.sortOrder ?? -1) + 1;
      uploaded = await uploadEntityImages(
        files,
        "products",
        product.code,
        startAt
      );

      await prisma.productImage.createMany({
        data: uploaded.map(image => ({ productId, ...image })),
      });
      persisted = true;
      await this.syncProductPrimaryImage(productId);

      const images = await prisma.productImage.findMany({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.status(201).json({ data: images });
    } catch (error) {
      if (!persisted) await cleanupEntityImages(uploaded.map(i => i.url));
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteProductImage(req: Request, res: Response) {
    try {
      const imageId = parseId(req.params.imageId, "Product image id");
      const image = await prisma.productImage.findUnique({
        where: { id: imageId },
      });
      if (!image) throw new NotFoundError("Product image");

      await prisma.productImage.delete({ where: { id: imageId } });
      await this.syncProductPrimaryImage(image.productId);
      await cleanupEntityImages([image.url]);
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, "Delete product image");
    }
  }

  async uploadSupplierLogo(req: Request, res: Response) {
    const operation = "Upload supplier logo";
    let uploaded: Array<{ url: string; sortOrder: number }> = [];
    let persisted = false;

    try {
      const supplierId = parseId(req.params.id, "Supplier id");
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, code: true, logoUrl: true },
      });
      if (!supplier) throw new NotFoundError("Supplier");

      const files = requireImageFiles(this.files(req));
      if (files.length > 1) {
        throw new DomainError("A supplier has a single logo", {
          status: 400,
          code: "IMAGE_LIMIT_EXCEEDED",
        });
      }

      uploaded = await uploadEntityImages(
        files,
        "suppliers",
        `${supplier.code}-logo`
      );
      const logoUrl = uploaded[0]?.url ?? null;

      const updated = await prisma.supplier.update({
        where: { id: supplierId },
        data: { logoUrl },
        select: { id: true, code: true, name: true, logoUrl: true },
      });
      persisted = true;

      // Replacing a logo orphans the previous object.
      if (supplier.logoUrl) await cleanupEntityImages([supplier.logoUrl]);

      return res.status(201).json({ data: updated });
    } catch (error) {
      if (!persisted) await cleanupEntityImages(uploaded.map(i => i.url));
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteSupplierLogo(req: Request, res: Response) {
    try {
      const supplierId = parseId(req.params.id, "Supplier id");
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, logoUrl: true },
      });
      if (!supplier) throw new NotFoundError("Supplier");
      if (!supplier.logoUrl) return res.status(204).send();

      await prisma.supplier.update({
        where: { id: supplierId },
        data: { logoUrl: null },
      });
      await cleanupEntityImages([supplier.logoUrl]);
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, "Delete supplier logo");
    }
  }

  async listReceiptImages(req: Request, res: Response) {
    try {
      const grnId = parseId(req.params.id, "Goods receipt id");
      const grn = await prisma.goodsReceiptNote.findUnique({
        where: { id: grnId },
        select: { id: true },
      });
      if (!grn) throw new NotFoundError("Goods receipt");

      const images = await prisma.goodsReceiptImage.findMany({
        where: { grnId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.json({ data: images });
    } catch (error) {
      handleSupplyChainError(error, res, "List goods receipt images");
    }
  }

  async addReceiptImages(req: Request, res: Response) {
    const operation = "Add goods receipt images";
    let uploaded: Array<{ url: string; sortOrder: number }> = [];
    let persisted = false;

    try {
      const grnId = parseId(req.params.id, "Goods receipt id");
      const grn = await prisma.goodsReceiptNote.findUnique({
        where: { id: grnId },
        select: {
          id: true,
          grnNumber: true,
          _count: { select: { images: true } },
        },
      });
      if (!grn) throw new NotFoundError("Goods receipt");

      // Photos may be pinned to one received line (damage on a specific item).
      const grnLineId = parseOptionalId(req.body.grnLineId, "Receipt line id");
      if (grnLineId !== null) {
        const line = await prisma.goodsReceiptLine.findFirst({
          where: { id: grnLineId, grnId },
          select: { id: true },
        });
        if (!line) {
          throw new DomainError(
            "That receipt line does not belong to this goods receipt",
            { status: 400, code: "LINE_MISMATCH" }
          );
        }
      }
      const caption = optionalString(req.body.caption);

      const files = requireImageFiles(this.files(req));
      assertImageLimit(
        grn._count.images,
        files.length,
        RECEIPT_IMAGE_LIMIT,
        "goods receipt"
      );

      const last = await prisma.goodsReceiptImage.aggregate({
        where: { grnId },
        _max: { sortOrder: true },
      });
      const startAt = (last._max.sortOrder ?? -1) + 1;
      uploaded = await uploadEntityImages(
        files,
        "goods-receipts",
        grn.grnNumber,
        startAt
      );

      await prisma.goodsReceiptImage.createMany({
        data: uploaded.map(image => ({
          grnId,
          grnLineId,
          caption,
          ...image,
        })),
      });
      persisted = true;

      const images = await prisma.goodsReceiptImage.findMany({
        where: { grnId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.status(201).json({ data: images });
    } catch (error) {
      if (!persisted) await cleanupEntityImages(uploaded.map(i => i.url));
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteReceiptImage(req: Request, res: Response) {
    try {
      const imageId = parseId(req.params.imageId, "Goods receipt image id");
      const image = await prisma.goodsReceiptImage.findUnique({
        where: { id: imageId },
      });
      if (!image) throw new NotFoundError("Goods receipt image");

      await prisma.goodsReceiptImage.delete({ where: { id: imageId } });
      await cleanupEntityImages([image.url]);
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, "Delete goods receipt image");
    }
  }

  async listQualityCheckImages(req: Request, res: Response) {
    try {
      const qualityCheckId = parseId(req.params.id, "Quality check id");
      const check = await prisma.qualityCheck.findUnique({
        where: { id: qualityCheckId },
        select: { id: true },
      });
      if (!check) throw new NotFoundError("Quality check");

      const images = await prisma.qualityCheckImage.findMany({
        where: { qualityCheckId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.json({ data: images });
    } catch (error) {
      handleSupplyChainError(error, res, "List quality check images");
    }
  }

  async addQualityCheckImages(req: Request, res: Response) {
    const operation = "Add quality check images";
    let uploaded: Array<{ url: string; sortOrder: number }> = [];
    let persisted = false;

    try {
      const qualityCheckId = parseId(req.params.id, "Quality check id");
      const check = await prisma.qualityCheck.findUnique({
        where: { id: qualityCheckId },
        select: {
          id: true,
          qcNumber: true,
          _count: { select: { images: true } },
        },
      });
      if (!check) throw new NotFoundError("Quality check");

      const caption = optionalString(req.body.caption);
      const files = requireImageFiles(this.files(req));
      assertImageLimit(
        check._count.images,
        files.length,
        QUALITY_CHECK_IMAGE_LIMIT,
        "quality check"
      );

      const last = await prisma.qualityCheckImage.aggregate({
        where: { qualityCheckId },
        _max: { sortOrder: true },
      });
      const startAt = (last._max.sortOrder ?? -1) + 1;
      uploaded = await uploadEntityImages(
        files,
        "quality-checks",
        check.qcNumber,
        startAt
      );

      await prisma.qualityCheckImage.createMany({
        data: uploaded.map(image => ({
          qualityCheckId,
          caption,
          ...image,
        })),
      });
      persisted = true;

      const images = await prisma.qualityCheckImage.findMany({
        where: { qualityCheckId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return res.status(201).json({ data: images });
    } catch (error) {
      if (!persisted) await cleanupEntityImages(uploaded.map(i => i.url));
      handleSupplyChainError(error, res, operation);
    }
  }

  async deleteQualityCheckImage(req: Request, res: Response) {
    try {
      const imageId = parseId(req.params.imageId, "Quality check image id");
      const image = await prisma.qualityCheckImage.findUnique({
        where: { id: imageId },
      });
      if (!image) throw new NotFoundError("Quality check image");

      await prisma.qualityCheckImage.delete({ where: { id: imageId } });
      await cleanupEntityImages([image.url]);
      return res.status(204).send();
    } catch (error) {
      handleSupplyChainError(error, res, "Delete quality check image");
    }
  }
}
