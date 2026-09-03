import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  normalizeEmail,
  isValidPincode,
  validateFieldLength,
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";
import { buildFullName } from "../utils/name-helpers.js";
import { parsePhoneNumber } from "../utils/phone-helper.js";
import { Prisma } from "@prisma/client";

export class ContactController {
  async getAllContacts(req: Request, res: Response) {
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
          "Get all contacts"
        );
      }
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
      handleError(error, res, "Get all contacts");
    }
  }

  async createContact(req: Request, res: Response) {
    try {
      const { name, email, phone, position, accountId, city, state, pincode } =
        req.body || {};

      if (
        !validateRequiredFields(
          req.body,
          ["name", "email"],
          res,
          "Create contact"
        )
      ) {
        return;
      }

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
          "Invalid email address",
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
      if (city && !validateFieldLength(city, 100)) {
        return handleValidationError(
          res,
          "City must be 100 characters or less",
          "city",
          "Create contact"
        );
      }
      if (state && !validateFieldLength(state, 100)) {
        return handleValidationError(
          res,
          "State must be 100 characters or less",
          "state",
          "Create contact"
        );
      }
      if (pincode && !isValidPincode(pincode)) {
        return handleValidationError(
          res,
          "Pincode must contain 6 digits",
          "pincode",
          "Create contact"
        );
      }
      const normalizedAccountId =
        accountId === undefined || accountId === null || accountId === ""
          ? null
          : Number(accountId);
      if (
        normalizedAccountId !== null &&
        (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0)
      ) {
        return handleValidationError(
          res,
          "Account ID is invalid",
          "accountId",
          "Create contact"
        );
      }
      if (
        normalizedAccountId !== null &&
        !(await prisma.account.findUnique({
          where: { id: normalizedAccountId },
          select: { id: true },
        }))
      ) {
        return handleValidationError(
          res,
          "Account does not exist",
          "accountId",
          "Create contact"
        );
      }

      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      const contact = await prisma.contact.create({
        data: {
          name: name.trim(),
          email: normalizeEmail(email)!,
          phone: localPhone || null,
          countryCode,
          position: position?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          pincode: pincode?.trim() || null,
          accountId: normalizedAccountId,
        },
        include: {
          account: true,
        },
      });
      res.status(201).json(contact);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res
          .status(409)
          .json({ error: "A contact with this email already exists" });
      }
      handleError(error, res, "Create contact");
    }
  }

  async getContactById(req: Request, res: Response) {
    try {
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "id",
          "Get contact by ID"
        );
      }
      const contact = await prisma.contact.findUnique({
        where: { id },
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
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "id",
          "Update contact"
        );
      }
      const { name, email, phone, position, accountId, city, state, pincode } =
        req.body || {};
      if (
        [name, email, phone, position, accountId, city, state, pincode].every(
          value => value === undefined
        )
      ) {
        return handleValidationError(
          res,
          "At least one contact field is required",
          undefined,
          "Update contact"
        );
      }

      if (name !== undefined && !isValidName(name)) {
        return handleValidationError(
          res,
          "Name must be non-empty (max 255 characters)",
          "name",
          "Update contact"
        );
      }

      if (email !== undefined && !isValidEmail(email)) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Update contact"
        );
      }

      if (phone !== undefined && phone && !isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Update contact"
        );
      }

      if (
        position !== undefined &&
        position &&
        !validateFieldLength(position, 255)
      ) {
        return handleValidationError(
          res,
          "Position must be 255 characters or less",
          "position",
          "Update contact"
        );
      }

      if (city && !validateFieldLength(city, 100)) {
        return handleValidationError(
          res,
          "City must be 100 characters or less",
          "city",
          "Update contact"
        );
      }
      if (state && !validateFieldLength(state, 100)) {
        return handleValidationError(
          res,
          "State must be 100 characters or less",
          "state",
          "Update contact"
        );
      }
      if (pincode && !isValidPincode(pincode)) {
        return handleValidationError(
          res,
          "Pincode must contain 6 digits",
          "pincode",
          "Update contact"
        );
      }
      const normalizedAccountId =
        accountId === undefined
          ? undefined
          : accountId === null || accountId === ""
            ? null
            : Number(accountId);
      if (
        normalizedAccountId !== undefined &&
        normalizedAccountId !== null &&
        (!Number.isSafeInteger(normalizedAccountId) || normalizedAccountId <= 0)
      ) {
        return handleValidationError(
          res,
          "Account ID is invalid",
          "accountId",
          "Update contact"
        );
      }
      if (
        typeof normalizedAccountId === "number" &&
        !(await prisma.account.findUnique({
          where: { id: normalizedAccountId },
          select: { id: true },
        }))
      ) {
        return handleValidationError(
          res,
          "Account does not exist",
          "accountId",
          "Update contact"
        );
      }

      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const updateData = {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: normalizeEmail(email)! } : {}),
        ...(phone !== undefined
          ? {
              phone: parsedPhone?.localNumber || null,
              countryCode: parsedPhone?.countryCode || "91",
            }
          : {}),
        ...(position !== undefined
          ? { position: position.trim() || null }
          : {}),
        ...(city !== undefined ? { city: city.trim() || null } : {}),
        ...(state !== undefined ? { state: state.trim() || null } : {}),
        ...(pincode !== undefined ? { pincode: pincode.trim() || null } : {}),
        ...(normalizedAccountId !== undefined
          ? { accountId: normalizedAccountId }
          : {}),
      };

      const contact = await prisma.contact.update({
        where: { id },
        data: updateData,
        include: {
          account: true,
        },
      });

      res.json(contact);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res
          .status(409)
          .json({ error: "A contact with this email already exists" });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(res, "Contact", "Update contact");
      }
      handleError(error, res, "Update contact");
    }
  }

  async searchContacts(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (typeof q !== "string") {
        return res.status(400).json({ error: 'Search query "q" is required' });
      }

      const searchTerm = q.trim();
      if (searchTerm.length === 0 || searchTerm.length > 200) {
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
        take: 50,
      });
      const response = contacts.map(contact => ({
        ...contact,
        convertedLeads: contact.convertedLeads.map(lead => ({
          ...lead,
          name: buildFullName(lead.firstName, lead.lastName),
        })),
      }));

      res.json(response);
    } catch (error) {
      handleError(error, res, "Search contacts");
    }
  }
}
