import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  validateRequiredFields,
} from "../utils/errorHandler.js";

export class KeywordController {
  /**
   * Get all keywords with optional search
   * GET /api/keywords?search=term
   */
  async getAllKeywords(req: Request, res: Response) {
    try {
      const { search } = req.query;

      const whereClause: any = {};

      if (search && typeof search === "string" && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
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
      });

      return res.json({
        success: true,
        data: keywords,
      });
    } catch (error) {
      handleError(error, res, "Get all keywords");
    }
  }

  /**
   * Get keyword by ID
   * GET /api/keywords/:id
   */
  async getKeywordById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Keyword ID is required",
          "id",
          "Get keyword by ID"
        );
      }

      const keywordId = parseInt(id, 10);
      if (isNaN(keywordId)) {
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

  /**
   * Create a new keyword
   * POST /api/keywords
   * Body: { name: string }
   */
  async createKeyword(req: Request, res: Response) {
    try {
      if (!validateRequiredFields(req.body, ["name"], res, "Create keyword")) {
        return;
      }

      const { name } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return handleValidationError(
          res,
          "Keyword name is required",
          "name",
          "Create keyword"
        );
      }

      // Convert to lowercase and trim
      const keywordName = name.trim().toLowerCase();

      // Check if keyword already exists
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
    } catch (error: any) {
      if (error.code === "P2002") {
        return handleConflictError(
          res,
          "Keyword already exists",
          "Create keyword"
        );
      }
      handleError(error, res, "Create keyword");
    }
  }

  /**
   * Delete a keyword
   * DELETE /api/keywords/:id
   */
  async deleteKeyword(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Keyword ID is required",
          "id",
          "Delete keyword"
        );
      }

      const keywordId = parseInt(id, 10);
      if (isNaN(keywordId)) {
        return handleValidationError(
          res,
          "Invalid keyword ID",
          "id",
          "Delete keyword"
        );
      }

      // Check if keyword exists
      const keyword = await prisma.keyword.findUnique({
        where: { id: keywordId },
      });

      if (!keyword) {
        return handleNotFoundError(res, "Keyword", "Delete keyword");
      }

      // Delete the keyword (cascade will handle join table deletions)
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
