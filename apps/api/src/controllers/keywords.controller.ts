import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import { Prisma } from "@prisma/client";
import { parsePositiveInteger } from "../utils/validators.js";

export class KeywordController {
  async getAllKeywords(req: Request, res: Response) {
    try {
      const { search } = req.query;

      const whereClause: Prisma.KeywordWhereInput = {};

      if (search && typeof search === "string" && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        if (searchTerm.length > 100) {
          return handleValidationError(
            res,
            "Search cannot exceed 100 characters",
            "search",
            "Get all keywords"
          );
        }
        whereClause.name = {
          contains: searchTerm,
          mode: "insensitive",
        };
      }

      const keywords = await prisma.keyword.findMany({
        where: whereClause,
        orderBy: {
          name: "asc",
        },
        take: 1000,
      });

      return res.json({
        success: true,
        data: keywords,
      });
    } catch (error) {
      handleError(error, res, "Get all keywords");
    }
  }

  async getKeywordById(req: Request, res: Response) {
    try {
      const keywordId = parsePositiveInteger(req.params.id);
      if (keywordId === null) {
        return handleValidationError(
          res,
          "Invalid keyword ID",
          "id",
          "Get keyword by ID"
        );
      }

      const keyword = await prisma.keyword.findUnique({
        where: { id: keywordId },
      });

      if (!keyword) {
        return handleNotFoundError(res, "Keyword", "Get keyword by ID");
      }

      return res.json({
        success: true,
        data: keyword,
      });
    } catch (error) {
      handleError(error, res, "Get keyword by ID");
    }
  }

  async createKeyword(req: Request, res: Response) {
    try {
      if (!validateRequiredFields(req.body, ["name"], res, "Create keyword")) {
        return;
      }

      const { name } = req.body;

      if (
        !name ||
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return handleValidationError(
          res,
          "Keyword name must be between 1 and 100 characters",
          "name",
          "Create keyword"
        );
      }

      const keywordName = name.trim().toLowerCase();

      const existingKeyword = await prisma.keyword.findUnique({
        where: { name: keywordName },
      });

      if (existingKeyword) {
        return handleConflictError(
          res,
          "Keyword already exists",
          "Create keyword"
        );
      }

      const keyword = await prisma.keyword.create({
        data: {
          name: keywordName,
        },
      });

      return res.status(201).json({
        success: true,
        data: keyword,
        message: "Keyword created successfully",
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return handleConflictError(
          res,
          "Keyword already exists",
          "Create keyword"
        );
      }
      handleError(error, res, "Create keyword");
    }
  }

  async deleteKeyword(req: Request, res: Response) {
    try {
      const keywordId = parsePositiveInteger(req.params.id);
      if (keywordId === null) {
        return handleValidationError(
          res,
          "Invalid keyword ID",
          "id",
          "Delete keyword"
        );
      }

      const keyword = await prisma.keyword.findUnique({
        where: { id: keywordId },
      });

      if (!keyword) {
        return handleNotFoundError(res, "Keyword", "Delete keyword");
      }

      await prisma.keyword.delete({
        where: { id: keywordId },
      });

      return res.json({
        success: true,
        message: "Keyword deleted successfully",
      });
    } catch (error) {
      handleError(error, res, "Delete keyword");
    }
  }
}
