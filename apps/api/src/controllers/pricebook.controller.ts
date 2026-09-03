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
  parseBoundedInteger,
  parsePositiveInteger,
  parseStrictBoolean,
} from "../utils/validators.js";

const PRICE_BOOK_SELECT = {
  id: true,
  name: true,
  currencyCode: true,
  isActive: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PriceBookSelect;

export class PriceBookController {
  private parsePriceBookId(
    id: string | undefined,
    res: Response,
    operation: string
  ): number | null {
    const pricebookId = parsePositiveInteger(id);
    if (pricebookId === null) {
      handleValidationError(res, "Invalid PriceBook ID", "id", operation);
      return null;
    }
    return pricebookId;
  }

  async getAllPriceBooks(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const pageNum = parseBoundedInteger(page, 1, 1_000_000);
      const limitNum = parseBoundedInteger(limit, 1, 100);

      if (pageNum === null || limitNum === null) {
        return handleValidationError(
          res,
          "page must be positive and limit must be between 1 and 100",
          undefined,
          "Get all price books"
        );
      }

      const [pricebooks, total] = await Promise.all([
        prisma.priceBook.findMany({
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          orderBy: { createdAt: "desc" },
          select: PRICE_BOOK_SELECT,
        }),
        prisma.priceBook.count(),
      ]);

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
        select: PRICE_BOOK_SELECT,
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
      const { name, description, currencyCode } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 160
      ) {
        return handleValidationError(
          res,
          "Name must be between 1 and 160 characters",
          "name",
          "Create price book"
        );
      }
      if (
        description !== undefined &&
        (typeof description !== "string" || description.trim().length > 2000)
      ) {
        return handleValidationError(
          res,
          "Description must be text no longer than 2000 characters",
          "description",
          "Create price book"
        );
      }

      const currencySetting = await prisma.globalSetting.findUnique({
        where: { key: "defaultCurrency" },
      });
      const selectedCurrency =
        typeof currencyCode === "string" && currencyCode.trim()
          ? currencyCode.trim().toUpperCase()
          : currencySetting?.value?.trim().toUpperCase() || "INR";
      if (!/^[A-Z]{3}$/.test(selectedCurrency)) {
        return handleValidationError(
          res,
          "Currency code must contain exactly three letters",
          "currencyCode",
          "Create price book"
        );
      }
      const currency = await prisma.currency.findUnique({
        where: { code: selectedCurrency },
        select: { code: true },
      });
      if (!currency) {
        return handleValidationError(
          res,
          "Unsupported currency code",
          "currencyCode",
          "Create price book"
        );
      }

      const pricebook = await prisma.priceBook.create({
        data: {
          name: name.trim(),
          description: description?.trim() || undefined,
          currencyCode: currency.code,
        },
        select: PRICE_BOOK_SELECT,
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

      const { name, description, currencyCode, isActive } = req.body;
      if (
        name === undefined &&
        description === undefined &&
        currencyCode === undefined &&
        isActive === undefined
      ) {
        return handleValidationError(
          res,
          "At least one price book field is required",
          undefined,
          "Update price book"
        );
      }

      const data: Prisma.PriceBookUpdateInput = {};
      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.trim().length > 160
        ) {
          return handleValidationError(
            res,
            "Name must be between 1 and 160 characters",
            "name",
            "Update price book"
          );
        }
        data.name = name.trim();
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
            "Update price book"
          );
        }
        data.description = description.trim() || null;
      }
      if (currencyCode !== undefined) {
        if (
          typeof currencyCode !== "string" ||
          !/^[A-Z]{3}$/.test(currencyCode.trim().toUpperCase())
        ) {
          return handleValidationError(
            res,
            "Currency code must contain exactly three letters",
            "currencyCode",
            "Update price book"
          );
        }
        const normalizedCurrency = currencyCode.trim().toUpperCase();
        const currency = await prisma.currency.findUnique({
          where: { code: normalizedCurrency },
          select: { code: true },
        });
        if (!currency) {
          return handleValidationError(
            res,
            "Unsupported currency code",
            "currencyCode",
            "Update price book"
          );
        }
        data.currency = { connect: { code: currency.code } };
      }
      if (isActive !== undefined) {
        const parsed = parseStrictBoolean(isActive);
        if (parsed === null) {
          return handleValidationError(
            res,
            "isActive must be true or false",
            "isActive",
            "Update price book"
          );
        }
        data.isActive = parsed;
      }

      const pricebook = await prisma.priceBook.update({
        where: { id: pricebookId },
        data,
        select: PRICE_BOOK_SELECT,
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
