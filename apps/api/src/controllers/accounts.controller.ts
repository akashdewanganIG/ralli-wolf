import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import { buildFullName } from "../utils/name-helpers.js";
import {
  normalizeHttpUrl,
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";
import { Prisma } from "@prisma/client";

export class AccountController {
  async getAllAccounts(req: Request, res: Response) {
    try {
      const page =
        req.query.page === undefined
          ? 1
          : parseBoundedInteger(req.query.page, 1, 1_000_000);
      const limit =
        req.query.limit === undefined
          ? 10
          : parseBoundedInteger(req.query.limit, 1, 100);
      if (page === null || limit === null) {
        return handleValidationError(
          res,
          "page must be positive and limit must be between 1 and 100",
          undefined,
          "Get all accounts"
        );
      }
      const skip = (page - 1) * limit;

      const totalItems = await prisma.account.count();
      const accounts = await prisma.account.findMany({
        skip,
        take: limit,
        include: {
          contacts: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              position: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      res.json({
        data: accounts,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      });
    } catch (error) {
      handleError(error, res, "Get all accounts");
    }
  }

  async getAccountDetails(req: Request, res: Response) {
    try {
      const accountId = parsePositiveInteger(req.params.accountId);
      if (accountId === null) {
        return handleValidationError(
          res,
          "Account ID is required",
          "accountId",
          "Get account details"
        );
      }

      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: {
          contacts: {
            include: {
              convertedLeads: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  status: true,
                  createdAt: true,
                },
              },
              campaignMembers: {
                include: {
                  campaign: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                      startDate: true,
                      endDate: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!account) {
        return handleNotFoundError(res, "Account", "Get account details");
      }

      const normalizedAccount = {
        ...account,
        contacts: account.contacts.map(contact => ({
          ...contact,
          convertedLeads: contact.convertedLeads.map(lead => ({
            ...lead,
            name: buildFullName(lead.firstName, lead.lastName),
          })),
        })),
      };

      res.json(normalizedAccount);
    } catch (error) {
      handleError(error, res, "Get account details");
    }
  }

  async searchAccountContacts(req: Request, res: Response) {
    try {
      const accountId = parsePositiveInteger(req.params.accountId);
      const { q } = req.query;

      if (accountId === null) {
        return handleValidationError(
          res,
          "Account ID is required",
          "accountId",
          "Search account contacts"
        );
      }

      if (typeof q !== "string" || !q.trim() || q.trim().length > 200) {
        return handleValidationError(
          res,
          'Search query "q" is required',
          "q",
          "Search account contacts"
        );
      }

      const contacts = await prisma.contact.findMany({
        where: {
          accountId,
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" } },
            { email: { contains: q.trim(), mode: "insensitive" } },
            { phone: { contains: q.trim(), mode: "insensitive" } },
            { position: { contains: q.trim(), mode: "insensitive" } },
          ],
        },
        take: 50,
        include: {
          account: true,
          convertedLeads: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      const normalizedContacts = contacts.map(contact => ({
        ...contact,
        convertedLeads: contact.convertedLeads.map(lead => ({
          ...lead,
          name: buildFullName(lead.firstName, lead.lastName),
        })),
      }));

      res.json(normalizedContacts);
    } catch (error) {
      handleError(error, res, "Search account contacts");
    }
  }

  async searchAccounts(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (typeof q !== "string" || !q.trim() || q.trim().length > 200) {
        return handleValidationError(
          res,
          'Search query "q" is required',
          "q",
          "Search accounts"
        );
      }

      const accounts = await prisma.account.findMany({
        where: {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" } },
            { industry: { contains: q.trim(), mode: "insensitive" } },
            { website: { contains: q.trim(), mode: "insensitive" } },
          ],
        },
        take: 50,
        include: {
          contacts: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              position: true,
              createdAt: true,
            },
          },
        },
      });

      res.json(accounts);
    } catch (error) {
      handleError(error, res, "Search accounts");
    }
  }

  async updateAccount(req: Request, res: Response) {
    try {
      const accountId = parsePositiveInteger(req.params.id);
      if (accountId === null) {
        return handleValidationError(
          res,
          "Account ID must be a valid number",
          "id",
          "Update account"
        );
      }

      const { name, website, phone, description, industry } = req.body || {};

      if (
        [name, website, phone, description, industry].every(
          value => value === undefined
        )
      ) {
        return handleValidationError(
          res,
          "At least one account field is required",
          undefined,
          "Update account"
        );
      }

      if (name !== undefined && typeof name !== "string") {
        return handleValidationError(
          res,
          "Name must be a string",
          "name",
          "Update account"
        );
      }
      const normalizedName = typeof name === "string" ? name.trim() : undefined;
      if (
        normalizedName !== undefined &&
        (normalizedName.length < 1 || normalizedName.length > 255)
      ) {
        return handleValidationError(
          res,
          "Name must contain between 1 and 255 characters",
          "name",
          "Update account"
        );
      }
      if (website !== undefined && typeof website !== "string") {
        return handleValidationError(
          res,
          "Website must be a string",
          "website",
          "Update account"
        );
      }
      let normalizedWebsite: string | null | undefined;
      if (website !== undefined) {
        try {
          normalizedWebsite = normalizeHttpUrl(website);
        } catch (error) {
          return handleValidationError(
            res,
            error instanceof Error ? error.message : "Website is invalid",
            "website",
            "Update account"
          );
        }
      }
      if (phone !== undefined && typeof phone !== "string") {
        return handleValidationError(
          res,
          "Phone must be a string",
          "phone",
          "Update account"
        );
      }
      const normalizedPhone =
        typeof phone === "string" ? phone.trim() || null : undefined;
      if (
        typeof normalizedPhone === "string" &&
        (normalizedPhone.length > 32 ||
          !/^[0-9+().\-\s]+$/.test(normalizedPhone))
      ) {
        return handleValidationError(
          res,
          "Phone must contain at most 32 valid phone characters",
          "phone",
          "Update account"
        );
      }
      if (description !== undefined && typeof description !== "string") {
        return handleValidationError(
          res,
          "Description must be a string",
          "description",
          "Update account"
        );
      }
      const normalizedDescription =
        typeof description === "string"
          ? description.trim() || null
          : undefined;
      if (
        typeof normalizedDescription === "string" &&
        normalizedDescription.length > 5000
      ) {
        return handleValidationError(
          res,
          "Description cannot exceed 5000 characters",
          "description",
          "Update account"
        );
      }
      if (industry !== undefined && typeof industry !== "string") {
        return handleValidationError(
          res,
          "Industry must be a string",
          "industry",
          "Update account"
        );
      }
      const normalizedIndustry =
        typeof industry === "string" ? industry.trim() || null : undefined;
      if (
        typeof normalizedIndustry === "string" &&
        normalizedIndustry.length > 255
      ) {
        return handleValidationError(
          res,
          "Industry cannot exceed 255 characters",
          "industry",
          "Update account"
        );
      }

      const data: Prisma.AccountUpdateInput = {};
      if (normalizedName !== undefined) data.name = normalizedName;
      if (website !== undefined) data.website = normalizedWebsite;
      if (normalizedPhone !== undefined) data.phone = normalizedPhone;
      if (normalizedDescription !== undefined)
        data.description = normalizedDescription;
      if (normalizedIndustry !== undefined) data.industry = normalizedIndustry;

      const updated = await prisma.account.update({
        where: { id: accountId },
        data,
        include: {
          contacts: true,
        },
      });

      return res.json(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(res, "Account", "Update account");
      }
      handleError(error, res, "Update account");
    }
  }
}
