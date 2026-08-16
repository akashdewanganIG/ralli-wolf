import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handlePrismaError,
} from "../utils/errorHandler.js";

export class PriceBookController {
  private parsePriceBookId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, "PriceBook ID is required", "id", operation);
      return null;
    }
    const pricebookId = parseInt(id, 10);
    if (isNaN(pricebookId)) {
      handleValidationError(res, "Invalid PriceBook ID", "id", operation);
      return null;
    }
    return pricebookId;
  }

  async getAllPriceBooks(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);

      if (isNaN(pageNum) || isNaN(limitNum)) {
        return handleValidationError(
          res,
          "page and limit must be numbers",
          undefined,
          "Get all price books"
        );
      }

      const pricebooks = await prisma.priceBook.findMany({
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.priceBook.count();

      return res.json({
        data: pricebooks,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      handleError(error, res, "Get all price books");
    }
  }

  async getPriceBookById(req: Request, res: Response) {
    try {
      const pricebookId = this.parsePriceBookId(
        req.params.id,
        res,
        "Get price book"
      );
      if (pricebookId === null) return;

      const pricebook = await prisma.priceBook.findUnique({
        where: { id: pricebookId },
      });

      if (!pricebook) {
        return handleNotFoundError(res, "PriceBook", "Get price book");
      }

      return res.json({
        data: pricebook,
      });
    } catch (error) {
      handleError(error, res, "Get price book");
    }
  }

  async createPriceBook(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return handleValidationError(
          res,
          "Name is required",
          "name",
          "Create price book"
        );
      }

      const currencySetting = await prisma.globalSetting.findUnique({
        where: { key: "defaultCurrency" },
      });

      const pricebook = await prisma.priceBook.create({
        data: {
          name,
          description,
          currencyCode: currencySetting?.value || "INR",
        },
      });

      return res.status(201).json({
        data: pricebook,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Create price book");
        return;
      }
      handleError(error, res, "Create price book");
    }
  }

  async updatePriceBook(req: Request, res: Response) {
    try {
      const pricebookId = this.parsePriceBookId(
        req.params.id,
        res,
        "Update price book"
      );
      if (pricebookId === null) return;

      const { name, description } = req.body;

      const pricebook = await prisma.priceBook.update({
        where: { id: pricebookId },
        data: {
          name,
          description,
        },
      });

      return res.json({
        data: pricebook,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Update price book");
        return;
      }
      handleError(error, res, "Update price book");
    }
  }

  async deletePriceBook(req: Request, res: Response) {
    try {
      const pricebookId = this.parsePriceBookId(
        req.params.id,
        res,
        "Delete price book"
      );
      if (pricebookId === null) return;

      await prisma.priceBook.delete({
        where: { id: pricebookId },
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(error, res, "Delete price book");
        return;
      }
      handleError(error, res, "Delete price book");
    }
  }
}
