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
  parsePositiveDecimal,
  parsePositiveInteger,
  parseStrictBoolean,
} from "../utils/validators.js";

const PRICE_BOOK_ENTRY_SELECT = {
  id: true,
  listPrice: true,
  useStandardPrice: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  productId: true,
  priceBookId: true,
  priceBook: {
    select: {
      id: true,
      name: true,
      currencyCode: true,
      isActive: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      imageUrl: true,
      description: true,
      categoryId: true,
      active: true,
      component: true,
    },
  },
} satisfies Prisma.PriceBookEntrySelect;

export class PriceBookEntryController {
  private parsePriceBookEntryId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    const pricebookEntryId = parsePositiveInteger(id);
    if (pricebookEntryId === null) {
      handleValidationError(res, "Invalid PriceBookEntry ID", "id", operation);
      return null;
    }
    return pricebookEntryId;
  }

  async getPriceBookEntries(req: Request, res: Response) {
    try {
      const priceBookId = parsePositiveInteger(req.params.priceBookId);
      if (priceBookId === null) {
        return handleValidationError(
          res,
          "Invalid price book ID",
          "priceBookId",
          "Get price book entries"
        );
      }
      const entries = await prisma.priceBookEntry.findMany({
        where: { priceBookId },
        orderBy: { createdAt: "desc" },
        select: PRICE_BOOK_ENTRY_SELECT,
      });

      return res.json({
        data: entries,
      });
    } catch (error) {
      handleError(error, res, "Get all price book entries");
    }
  }
  async getAllPriceBookEntries(req: Request, res: Response) {
    try {
      const { productId } = req.query;
      if (!productId) {
        return handleValidationError(
          res,
          "productId is required",
          "productId",
          "Get all price book entries"
        );
      }
      const productIdNum = parsePositiveInteger(productId);
      if (productIdNum === null) {
        return handleValidationError(
          res,
          "Invalid product ID",
          "productId",
          "Get all price book entries"
        );
      }

      const entries = await prisma.priceBookEntry.findMany({
        where: { productId: productIdNum },
        orderBy: { createdAt: "desc" },
        select: PRICE_BOOK_ENTRY_SELECT,
      });

      return res.json({
        data: entries,
      });
    } catch (error) {
      handleError(error, res, "Get all price book entries");
    }
  }

  async getPriceBookEntryById(req: Request, res: Response) {
    try {
      const entryId = this.parsePriceBookEntryId(
        req.params.id,
        res,
        "Get price book entry"
      );
      if (entryId === null) return;

      const entry = await prisma.priceBookEntry.findUnique({
        where: { id: entryId },
        select: PRICE_BOOK_ENTRY_SELECT,
      });

      if (!entry) {
        return handleNotFoundError(
          res,
          "PriceBookEntry",
          "Get price book entry"
        );
      }

      return res.json({
        data: entry,
      });
    } catch (error) {
      handleError(error, res, "Get price book entry");
    }
  }

  async createPriceBookEntry(req: Request, res: Response) {
    try {
      const { priceBookId, productId, listPrice, useStandardPrice, isActive } =
        req.body;

      if (
        priceBookId === undefined ||
        productId === undefined ||
        listPrice === undefined
      ) {
        return handleValidationError(
          res,
          "Missing required fields: priceBookId, productId, and listPrice are required",
          undefined,
          "Create price book entry"
        );
      }

      const parsedPriceBookId = parsePositiveInteger(priceBookId);
      const parsedProductId = parsePositiveInteger(productId);
      const parsedListPrice = parsePositiveDecimal(listPrice);
      if (parsedPriceBookId === null || parsedProductId === null) {
        return handleValidationError(
          res,
          "priceBookId and productId must be positive integers",
          undefined,
          "Create price book entry"
        );
      }
      if (parsedListPrice === null) {
        return handleValidationError(
          res,
          "listPrice must be a positive decimal with at most 4 fractional digits",
          "listPrice",
          "Create price book entry"
        );
      }
      const parsedUseStandardPrice =
        useStandardPrice === undefined
          ? true
          : parseStrictBoolean(useStandardPrice);
      const parsedIsActive =
        isActive === undefined ? true : parseStrictBoolean(isActive);
      if (parsedUseStandardPrice === null || parsedIsActive === null) {
        return handleValidationError(
          res,
          "useStandardPrice and isActive must be true or false",
          undefined,
          "Create price book entry"
        );
      }

      const entry = await prisma.priceBookEntry.create({
        data: {
          priceBookId: parsedPriceBookId,
          productId: parsedProductId,
          listPrice: new Prisma.Decimal(parsedListPrice),
          useStandardPrice: parsedUseStandardPrice,
          isActive: parsedIsActive,
        },
        select: PRICE_BOOK_ENTRY_SELECT,
      });

      return res.status(201).json({
        data: entry,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Create price book entry");
        return;
      }
      handleError(error, res, "Create price book entry");
    }
  }

  async updatePriceBookEntry(req: Request, res: Response) {
    try {
      const entryId = this.parsePriceBookEntryId(
        req.params.id,
        res,
        "Update price book entry"
      );
      if (entryId === null) return;

      const { listPrice, useStandardPrice, isActive } = req.body;
      if (
        listPrice === undefined &&
        useStandardPrice === undefined &&
        isActive === undefined
      ) {
        return handleValidationError(
          res,
          "At least one price book entry field is required",
          undefined,
          "Update price book entry"
        );
      }

      const data: Prisma.PriceBookEntryUpdateInput = {};
      if (listPrice !== undefined) {
        const parsedListPrice = parsePositiveDecimal(listPrice);
        if (parsedListPrice === null) {
          return handleValidationError(
            res,
            "listPrice must be a positive decimal with at most 4 fractional digits",
            "listPrice",
            "Update price book entry"
          );
        }
        data.listPrice = new Prisma.Decimal(parsedListPrice);
      }
      if (useStandardPrice !== undefined) {
        const parsed = parseStrictBoolean(useStandardPrice);
        if (parsed === null) {
          return handleValidationError(
            res,
            "useStandardPrice must be true or false",
            "useStandardPrice",
            "Update price book entry"
          );
        }
        data.useStandardPrice = parsed;
      }
      if (isActive !== undefined) {
        const parsed = parseStrictBoolean(isActive);
        if (parsed === null) {
          return handleValidationError(
            res,
            "isActive must be true or false",
            "isActive",
            "Update price book entry"
          );
        }
        data.isActive = parsed;
      }

      const entry = await prisma.priceBookEntry.update({
        where: { id: entryId },
        data,
        select: PRICE_BOOK_ENTRY_SELECT,
      });

      return res.json({
        data: entry,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Update price book entry");
        return;
      }
      handleError(error, res, "Update price book entry");
    }
  }

  async deletePriceBookEntry(req: Request, res: Response) {
    try {
      const entryId = this.parsePriceBookEntryId(
        req.params.id,
        res,
        "Delete price book entry"
      );
      if (entryId === null) return;

      await prisma.priceBookEntry.delete({
        where: { id: entryId },
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Delete price book entry");
        return;
      }
      handleError(error, res, "Delete price book entry");
    }
  }
}
