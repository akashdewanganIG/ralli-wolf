import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/errorHandler.js";

export class PriceBookEntryController {
  private parsePriceBookEntryId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(
        res,
        "PriceBookEntry ID is required",
        "id",
        operation
      );
      return null;
    }
    const pricebookEntryId = parseInt(id, 10);
    if (isNaN(pricebookEntryId)) {
      handleValidationError(res, "Invalid PriceBookEntry ID", "id", operation);
      return null;
    }
    return pricebookEntryId;
  }

  async getPriceBookEntries(req: Request, res: Response) {
    try {
      const entries = await prisma.priceBookEntry.findMany({
        where: { priceBookId: Number(req.params.priceBookId) },
        orderBy: { createdAt: "desc" },
        include: {
          priceBook: true,
          product: true,
        },
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
      const productIdNum = Number(productId);

      const entries = await prisma.priceBookEntry.findMany({
        where: { productId: productIdNum },
        orderBy: { createdAt: "desc" },
        include: {
          priceBook: true,
          product: true,
        },
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

      if (!priceBookId || !productId || listPrice === undefined) {
        return handleValidationError(
          res,
          "Missing required fields: priceBookId, productId, and listPrice are required",
          undefined,
          "Create price book entry"
        );
      }

      const listPriceFloat = parseFloat(listPrice);
      if (isNaN(listPriceFloat)) {
        return handleValidationError(
          res,
          "Invalid listPrice",
          "listPrice",
          "Create price book entry"
        );
      }

      const entry = await prisma.priceBookEntry.create({
        data: {
          priceBookId,
          productId,
          listPrice: listPriceFloat,
          useStandardPrice,
          isActive,
        },
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

      const data: Prisma.PriceBookEntryUpdateInput = {};
      if (listPrice !== undefined) {
        const listPriceFloat = parseFloat(listPrice);
        if (isNaN(listPriceFloat)) {
          return handleValidationError(
            res,
            "Invalid listPrice",
            "listPrice",
            "Update price book entry"
          );
        }
        data.listPrice = listPriceFloat;
      }
      if (useStandardPrice !== undefined) {
        data.useStandardPrice = useStandardPrice;
      }
      if (isActive !== undefined) {
        data.isActive = isActive;
      }

      const entry = await prisma.priceBookEntry.update({
        where: { id: entryId },
        data,
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
