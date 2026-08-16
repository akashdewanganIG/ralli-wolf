import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";
import { buildFullName } from "../utils/nameHelpers.js";

export class AccountController {
  async getAllAccounts(req: Request, res: Response) {
    try {
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
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
      const { accountId } = req.params;
      if (!accountId) {
        return handleValidationError(
          res,
          "Account ID is required",
          "accountId",
          "Get account details"
        );
      }

      const account = await prisma.account.findUnique({
        where: { id: parseInt(accountId) },
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
      const { accountId } = req.params;
      const { q } = req.query;

      if (!accountId) {
        return handleValidationError(
          res,
          "Account ID is required",
          "accountId",
          "Search account contacts"
        );
      }

      if (!q) {
        return handleValidationError(
          res,
          'Search query "q" is required',
          "q",
          "Search account contacts"
        );
      }

      const contacts = await prisma.contact.findMany({
        where: {
          accountId: parseInt(accountId),
          OR: [
            { name: { contains: q as string, mode: "insensitive" } },
            { email: { contains: q as string, mode: "insensitive" } },
            { phone: { contains: q as string, mode: "insensitive" } },
            { position: { contains: q as string, mode: "insensitive" } },
          ],
        },
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

      console.log(
        `Search found ${contacts.length} contacts for account ${accountId} with query: "${q}"`
      );
      const normalizedContacts = contacts.map(contact => ({
        ...contact,
        convertedLeads: contact.convertedLeads.map(lead => ({
          ...lead,
          name: buildFullName(lead.firstName, lead.lastName),
        })),
      }));

      res.json(normalizedContacts);
    } catch (error) {
      console.error("Search Account Contacts Error:", error);
      handleError(error, res, "Search account contacts");
    }
  }

  async searchAccounts(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q) {
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
            { name: { contains: q as string, mode: "insensitive" } },
            { industry: { contains: q as string, mode: "insensitive" } },
            { website: { contains: q as string, mode: "insensitive" } },
          ],
        },
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

      console.log(
        `Search found ${accounts.length} accounts with query: "${q}"`
      );
      res.json(accounts);
    } catch (error) {
      console.error("Search Accounts Error:", error);
      handleError(error, res, "Search accounts");
    }
  }

  async updateAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Account ID is required",
          "id",
          "Update account"
        );
      }

      const accountId = parseInt(id);
      if (isNaN(accountId)) {
        return handleValidationError(
          res,
          "Account ID must be a valid number",
          "id",
          "Update account"
        );
      }

      const { name, website, phone, description, industry } = req.body || {};

      // Minimal validation for common fields
      if (name !== undefined && typeof name !== "string") {
        return handleValidationError(
          res,
          "Name must be a string",
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
      if (phone !== undefined && typeof phone !== "string") {
        return handleValidationError(
          res,
          "Phone must be a string",
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
      if (industry !== undefined && typeof industry !== "string") {
        return handleValidationError(
          res,
          "Industry must be a string",
          "industry",
          "Update account"
        );
      }

      const updated = await prisma.account.update({
        where: { id: accountId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(website !== undefined ? { website } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(industry !== undefined ? { industry } : {}),
        },
        include: {
          contacts: true,
        },
      });

      return res.json(updated);
    } catch (error: any) {
      if (error?.code === "P2025") {
        return handleNotFoundError(res, "Account", "Update account");
      }
      handleError(error, res, "Update account");
    }
  }
}
