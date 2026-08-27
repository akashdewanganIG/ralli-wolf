import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  validateRequiredFields,
} from "../utils/errorHandler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  normalizeEmail,
  validateFieldLength,
} from "../utils/validators.js";
import { buildFullName } from "../utils/nameHelpers.js";
import { parsePhoneNumber } from "../utils/phoneHelper.js";

export class ContactController {
  async getAllContacts(req: Request, res: Response) {
    try {
      console.log("=== GET ALL CONTACTS ===");
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

      const totalItems = await prisma.contact.count();

      const contacts = await prisma.contact.findMany({
        skip,
        take: limit,
        include: {
          account: true,
          convertedLeads: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      console.log(
        `Found ${contacts.length} contacts (page ${page}/${totalPages})`
      );

      res.json({
        data: contacts,
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
      console.error("Get all contacts error:", error);
      handleError(error, res, "Get all contacts");
    }
  }

  async createContact(req: Request, res: Response) {
    try {
      const { name, email, phone, position, accountId } = req.body;

      // Validate required fields
      if (!validateRequiredFields(req.body, ["name"], res, "Create contact")) {
        return;
      }

      // Validate field formats and lengths
      if (!isValidName(name)) {
        return handleValidationError(
          res,
          "Name is required and must be non-empty (max 255 characters)",
          "name",
          "Create contact"
        );
      }

      if (email && !isValidEmail(email)) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Create contact"
        );
      }

      if (phone && !isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Create contact"
        );
      }

      if (position && !validateFieldLength(position, 255)) {
        return handleValidationError(
          res,
          "Position must be 255 characters or less",
          "position",
          "Create contact"
        );
      }

      // Parse phone number to extract country code
      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      const contact = await prisma.contact.create({
        data: {
          name,
          // `email` is unique and non-null on this table, so the stored form
          // has to be the canonical one or the same person can be inserted
          // twice. Falls through unchanged when absent, leaving the missing
          // required field to fail where it did before.
          email: normalizeEmail(email) ?? email,
          phone: localPhone,
          countryCode,
          position,
          accountId,
        },
        include: {
          account: true,
        },
      });
      res.status(201).json(contact);
    } catch (error) {
      handleError(error, res, "Create contact");
    }
  }

  async getContactById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "id",
          "Get contact by ID"
        );
      }
      const contact = await prisma.contact.findUnique({
        where: { id: parseInt(id) },
        include: {
          account: true,
          convertedLeads: true,
          campaignMembers: {
            include: {
              campaign: true,
            },
          },
        },
      });

      if (!contact) {
        return handleNotFoundError(res, "Contact", "Get contact by ID");
      }

      res.json(contact);
    } catch (error) {
      handleError(error, res, "Get contact by ID");
    }
  }

  async updateContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "id",
          "Update contact"
        );
      }
      const updateData = req.body;

      // Validate fields that are being updated
      if (updateData.name !== undefined && !isValidName(updateData.name)) {
        return handleValidationError(
          res,
          "Name must be non-empty (max 255 characters)",
          "name",
          "Update contact"
        );
      }

      if (
        updateData.email !== undefined &&
        updateData.email &&
        !isValidEmail(updateData.email)
      ) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Update contact"
        );
      }

      if (
        updateData.phone !== undefined &&
        updateData.phone &&
        !isValidPhone(updateData.phone)
      ) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Update contact"
        );
      }

      if (
        updateData.position !== undefined &&
        updateData.position &&
        !validateFieldLength(updateData.position, 255)
      ) {
        return handleValidationError(
          res,
          "Position must be 255 characters or less",
          "position",
          "Update contact"
        );
      }

      // Parse phone number to extract country code if phone is being updated
      if (updateData.phone) {
        const parsedPhone = parsePhoneNumber(updateData.phone);
        if (parsedPhone) {
          updateData.phone = parsedPhone.localNumber;
          updateData.countryCode = parsedPhone.countryCode;
        }
      }

      // Only when the caller actually sent an email: assigning here on an
      // absent field would null out a stored address.
      if (updateData.email !== undefined) {
        updateData.email = normalizeEmail(updateData.email);
      }

      const contact = await prisma.contact.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          account: true,
        },
      });

      res.json(contact);
    } catch (error: any) {
      if (error.code === "P2025") {
        // Record not found
        return handleNotFoundError(res, "Contact", "Update contact");
      }
      handleError(error, res, "Update contact");
    }
  }

  async searchContacts(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Search query "q" is required' });
      }

      const searchTerm = (q as string).trim();
      if (searchTerm.length === 0) {
        return res.status(400).json({ error: 'Search query "q" is required' });
      }

      const contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
            { phone: { contains: searchTerm, mode: "insensitive" } },
            { position: { contains: searchTerm, mode: "insensitive" } },
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
      const response = contacts.map(contact => ({
        ...contact,
        convertedLeads: contact.convertedLeads.map(lead => ({
          ...lead,
          name: buildFullName(lead.firstName, lead.lastName),
        })),
      }));

      console.log(
        `Search found ${contacts.length} contacts with query: "${searchTerm}"`
      );
      res.json(response);
    } catch (error) {
      console.error("Search Contacts Error:", error);
      handleError(error, res, "Search contacts");
    }
  }
}
