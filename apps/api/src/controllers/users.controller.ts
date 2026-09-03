import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, UserRole, Region } from "@prisma/client";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { generateAccountPlaceholder } from "../utils/password.utils.js";
import { emailService } from "../services/email.service.js";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  parseBoundedInteger,
  parsePositiveInteger,
} from "../utils/validators.js";
import { parsePhoneNumber } from "../utils/phone-helper.js";
import { createNotification } from "./notification.controller.js";
import { NotificationType } from "@prisma/client";
import { recordAuditLog } from "../utils/audit.utils.js";
import { isPermission } from "@repo/db/permissions";
import { logError } from "../utils/logger.js";

const VALID_REGIONS = ["SOUTH", "NORTH", "EAST", "WEST_1", "WEST_2", "APTOC"];
const VALID_ROLES = ["ADMIN", "SALES"];

const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.CUSTOM,
];
const DEFAULT_REGION = "SOUTH";
const MAX_IMPORT_ROWS = 1_000;

interface UploadedImportFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

interface ImportedUserResult {
  row: number;
  email: string;
  firstName: string;
  lastName: string;
  invitationEmailSent: boolean;
}

interface ImportedUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  region?: string;
  location?: string;
}

const isImportedUserInput = (value: unknown): value is ImportedUserInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.firstName === "string" &&
    typeof row.lastName === "string" &&
    typeof row.email === "string" &&
    ["phone", "role", "region", "location"].every(
      field => row[field] === undefined || typeof row[field] === "string"
    )
  );
};

const importFailureMessage = (error: unknown): string =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002"
    ? "User with this email already exists"
    : "User could not be created";

const shouldSendInvitationEmail = (_role: UserRole) => true;

function withoutAuthenticationSecrets<
  T extends {
    passwordHash: string;
    sessionVersion: number;
    passwordEnabled: boolean;
    totpSecret: string | null;
    totpVerifiedAt: Date | null;
    emailOtpVerifiedAt: Date | null;
  },
>(user: T) {
  const {
    passwordHash: _passwordHash,
    sessionVersion: _sessionVersion,
    passwordEnabled: _passwordEnabled,
    totpSecret: _totpSecret,
    totpVerifiedAt: _totpVerifiedAt,
    emailOtpVerifiedAt: _emailOtpVerifiedAt,
    ...safeUser
  } = user;
  return safeUser;
}

export class UserController {
  async getAllUsers(req: Request, res: Response) {
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
          "Page must be a positive integer and limit must be between 1 and 100",
          "pagination",
          "Get all users"
        );
      }

      const skip = (page - 1) * limit;

      const { role, region } = req.query;

      const whereClause: Prisma.UserWhereInput = {
        deletedAt: null,
      };
      if (role) {
        if (
          typeof role !== "string" ||
          !Object.values(UserRole).includes(role as UserRole)
        ) {
          return handleValidationError(
            res,
            "Invalid user role",
            "role",
            "Get all users"
          );
        }
        whereClause.role = role as UserRole;
      }
      if (region) {
        if (
          typeof region !== "string" ||
          !Object.values(Region).includes(region as Region)
        ) {
          return handleValidationError(
            res,
            "Invalid region",
            "region",
            "Get all users"
          );
        }
        whereClause.region = region as Region;
      }

      const totalItems = await prisma.user.count({ where: whereClause });

      const users = await prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          permissions: true,
          region: true,
          location: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      res.json({
        data: users,
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
      handleError(error, res, "Get all users");
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const { firstName, lastName, email, phone, role, region, location } =
        req.body;

      const requiredFields = ["firstName", "lastName", "email", "role"];
      if (
        !validateRequiredFields(req.body, requiredFields, res, "Create user")
      ) {
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!isValidName(firstName)) {
        return handleValidationError(
          res,
          "First name is required and must be non-empty (max 255 characters)",
          "firstName",
          "Create user"
        );
      }

      if (!isValidName(lastName)) {
        return handleValidationError(
          res,
          "Last name is required and must be non-empty (max 255 characters)",
          "lastName",
          "Create user"
        );
      }

      if (!isValidEmail(normalizedEmail)) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Create user"
        );
      }

      if (phone && !isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Create user"
        );
      }

      if (region) {
        const validRegions = [
          Region.SOUTH,
          Region.NORTH,
          Region.EAST,
          Region.WEST_1,
          Region.WEST_2,
          Region.APTOC,
        ];
        if (!validRegions.includes(region)) {
          return handleValidationError(
            res,
            "Invalid region. Must be SOUTH, NORTH, EAST, WEST_1, WEST_2, or APTOC",
            "region",
            "Create user"
          );
        }
      }

      if (!ASSIGNABLE_ROLES.includes(role)) {
        return handleValidationError(
          res,
          "Invalid role. Must be ADMIN, SALES, or CUSTOM",
          "role",
          "Create user"
        );
      }

      const requestedPermissions: string[] = Array.isArray(req.body.permissions)
        ? req.body.permissions
        : [];
      const customPermissions =
        role === UserRole.CUSTOM
          ? requestedPermissions.filter(isPermission)
          : [];

      if (role === UserRole.CUSTOM && customPermissions.length === 0) {
        return handleValidationError(
          res,
          "A custom role needs at least one permission",
          "permissions",
          "Create user"
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail, deletedAt: null },
      });

      if (existingUser) {
        return handleConflictError(
          res,
          `User with email ${normalizedEmail} already exists`,
          "Create user"
        );
      }

      const accountPlaceholder = generateAccountPlaceholder();
      const passwordHash = await bcrypt.hash(accountPlaceholder, 12);

      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      const normalizedLocation = location
        ? location
            .trim()
            .replace(/\s+/g, " ")
            .split(" ")
            .map(
              (word: string) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(" ")
        : null;

      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone: localPhone,
          countryCode,
          passwordHash,

          mustChangePassword: true,
          role,
          permissions: customPermissions,
          region: region || null,
          location: normalizedLocation,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          countryCode: true,
          role: true,
          permissions: true,
          region: true,
          location: true,
          createdAt: true,
        },
      });

      const sendInvitationEmail = shouldSendInvitationEmail(role as UserRole);

      let invitationEmailSent = false;

      if (sendInvitationEmail) {
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        try {
          invitationEmailSent = await emailService.sendUserInvitationEmail({
            name: fullName,
            email: normalizedEmail,
            role,
          });
        } catch {
          invitationEmailSent = false;
        }
      }

      res.status(201).json({
        ...user,
        invitationEmailSent,
        message: invitationEmailSent
          ? "User created successfully. A password-setup invitation was sent by email."
          : "User created successfully, but the invitation email could not be delivered. They can use Forgot password to establish access.",
      });
    } catch (error) {
      handleError(error, res, "Create user");
    }
  }

  async resendCredentials(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = parsePositiveInteger(id);
      if (userId === null) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Resend credentials"
        );
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt) {
        return handleNotFoundError(res, "User", "Resend credentials");
      }

      const accountPlaceholder = generateAccountPlaceholder();
      const passwordHash = await bcrypt.hash(accountPlaceholder, 12);

      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

      const emailSent = await emailService.sendUserInvitationEmail({
        name: fullName,
        email: user.email,
        role: user.role,
      });

      if (!emailSent) {
        return handleError(
          new Error(
            "The email provider did not accept the message. The existing password is unchanged."
          ),
          res,
          "Resend credentials"
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
        },
      });

      await recordAuditLog({
        action: "RESEND_USER_CREDENTIALS",
        changedBy: req.user?.id ?? userId,
        entityType: "USER",
        entityId: userId,
        oldValues: null,
        newValues: { email: user.email },
      });

      res.json({
        success: true,
        email: user.email,
        message: `A password-setup invitation was sent to ${user.email}.`,
      });
    } catch (error) {
      handleError(error, res, "Resend credentials");
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "User ID is required",
          "id",
          "Get user by ID"
        );
      }

      const userId = parsePositiveInteger(id);
      if (userId === null) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Get user by ID"
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId, deletedAt: null },
        include: {
          leads: true,
          campaigns: true,
        },
      });

      if (!user) {
        return handleNotFoundError(res, "User", "Get user by ID");
      }

      res.json(withoutAuthenticationSecrets(user));
    } catch (error) {
      handleError(error, res, "Get user by ID");
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "User ID is required",
          "id",
          "Update user"
        );
      }

      const userId = parsePositiveInteger(id);
      if (userId === null) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Update user"
        );
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        role,
        region,
        location,
        permissions,
      } = req.body ?? {};
      const updateData = {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(region !== undefined ? { region } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
        countryCode: undefined as string | undefined,
      };

      if (updateData.role !== undefined) {
        if (!ASSIGNABLE_ROLES.includes(updateData.role)) {
          return handleValidationError(
            res,
            "Invalid role. Must be ADMIN, SALES, or CUSTOM",
            "role",
            "Update user"
          );
        }

        if (updateData.role === UserRole.CUSTOM) {
          const selected = Array.isArray(updateData.permissions)
            ? updateData.permissions.filter(isPermission)
            : [];
          if (selected.length === 0) {
            return handleValidationError(
              res,
              "A custom role needs at least one permission",
              "permissions",
              "Update user"
            );
          }
          updateData.permissions = selected;
        } else {
          updateData.permissions = [];
        }
      } else if (updateData.permissions !== undefined) {
        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (target?.role !== UserRole.CUSTOM) {
          delete updateData.permissions;
        } else {
          updateData.permissions = Array.isArray(updateData.permissions)
            ? updateData.permissions.filter(isPermission)
            : [];
        }
      }

      if (
        updateData.firstName !== undefined &&
        !isValidName(updateData.firstName)
      ) {
        return handleValidationError(
          res,
          "First name must be non-empty (max 255 characters)",
          "firstName",
          "Update user"
        );
      }

      if (
        updateData.lastName !== undefined &&
        !isValidName(updateData.lastName)
      ) {
        return handleValidationError(
          res,
          "Last name must be non-empty (max 255 characters)",
          "lastName",
          "Update user"
        );
      }

      if (updateData.email !== undefined && !isValidEmail(updateData.email)) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Update user"
        );
      }
      if (updateData.email !== undefined) {
        updateData.email = updateData.email.trim().toLowerCase();
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
          "Update user"
        );
      }

      if (updateData.region !== undefined) {
        if (updateData.region === "" || updateData.region === null) {
          updateData.region = null;
        } else {
          const validRegions = [
            Region.SOUTH,
            Region.NORTH,
            Region.EAST,
            Region.WEST_1,
            Region.WEST_2,
            Region.APTOC,
          ];
          if (!validRegions.includes(updateData.region)) {
            return handleValidationError(
              res,
              "Invalid region. Must be SOUTH, NORTH, EAST, WEST_1, WEST_2, or APTOC",
              "region",
              "Update user"
            );
          }
        }
      }

      if (updateData.phone) {
        const parsedPhone = parsePhoneNumber(updateData.phone);
        if (parsedPhone) {
          updateData.phone = parsedPhone.localNumber;
          updateData.countryCode = parsedPhone.countryCode;
        }
      } else if (updateData.phone === "") {
        updateData.phone = null;
      }

      if (
        updateData.location !== undefined &&
        updateData.location !== null &&
        (typeof updateData.location !== "string" ||
          updateData.location.length > 255)
      ) {
        return handleValidationError(
          res,
          "Location must be text with at most 255 characters",
          "location",
          "Update user"
        );
      }

      const before = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      if (before && before.role !== user.role) {
        void createNotification({
          userId: user.id,
          type: NotificationType.ROLE_CHANGED,
          title: `Your role is now ${user.role}`,
          message: `An administrator changed your role from ${before.role} to ${user.role}. What you can reach in Ralli Wolf has changed accordingly.`,
        }).catch(error =>
          logError("user_role_change_notification_failed", error)
        );
      }

      res.json(withoutAuthenticationSecrets(user));
    } catch (error) {
      handleError(error, res, "Update user");
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "User ID is required",
          "id",
          "Delete user"
        );
      }

      const userId = parsePositiveInteger(id);
      if (userId === null) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Delete user"
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          deletedBy: req.user?.id,
          sessionVersion: { increment: 1 },
        },
      });

      void createNotification({
        userId,
        type: NotificationType.ACCOUNT_DEACTIVATED,
        title: "Your Ralli Wolf access has been switched off",
        message:
          "An administrator has deactivated your account, so you will no longer be able to sign in. If you believe this is a mistake, contact them.",
      }).catch(error =>
        logError("user_deactivation_notification_failed", error)
      );

      res.status(204).send();
    } catch (error) {
      handleError(error, res, "Delete user");
    }
  }

  async importUsers(req: Request, res: Response) {
    try {
      const usersData =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>).users
          : undefined;

      if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        return handleValidationError(
          res,
          "Users data is required",
          "users",
          "Import users"
        );
      }
      if (usersData.length > MAX_IMPORT_ROWS) {
        return handleValidationError(
          res,
          `A single import cannot exceed ${MAX_IMPORT_ROWS} users`,
          "users",
          "Import users"
        );
      }

      const results = {
        success: [] as ImportedUserResult[],
        errors: [] as { row: number; email: string; error: string }[],
      };

      for (let i = 0; i < usersData.length; i++) {
        const userData = usersData[i];
        const rowNum = i + 1;

        if (!isImportedUserInput(userData)) {
          results.errors.push({
            row: rowNum,
            email: "N/A",
            error: "Invalid row data",
          });
          continue;
        }

        try {
          if (!userData.firstName || !userData.lastName || !userData.email) {
            results.errors.push({
              row: rowNum,
              email: userData.email || "N/A",
              error: "First name, last name, and email are required",
            });
            continue;
          }
          if (
            !isValidName(userData.firstName) ||
            !isValidName(userData.lastName)
          ) {
            results.errors.push({
              row: rowNum,
              email: userData.email || "N/A",
              error: "First and last names cannot exceed 255 characters",
            });
            continue;
          }

          const normalizedEmail = userData.email.trim().toLowerCase();
          if (!isValidEmail(normalizedEmail)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "Invalid email format",
            });
            continue;
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (existingUser) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "User with this email already exists",
            });
            continue;
          }

          if (userData.phone && !isValidPhone(userData.phone)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "Invalid phone number format",
            });
            continue;
          }

          const role = (userData.role?.toUpperCase() || "SALES") as UserRole;
          if (!VALID_ROLES.includes(role)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
            });
            continue;
          }

          let region: Region | null = null;
          if (userData.region) {
            const normalizedRegion = userData.region
              .toUpperCase()
              .replace(" ", "_");
            if (VALID_REGIONS.includes(normalizedRegion)) {
              region = normalizedRegion as Region;
            } else {
              results.errors.push({
                row: rowNum,
                email: userData.email,
                error: `Invalid region. Must be one of: ${VALID_REGIONS.join(", ")}`,
              });
              continue;
            }
          } else {
            region = DEFAULT_REGION as Region;
          }

          const accountPlaceholder = generateAccountPlaceholder();
          const passwordHash = await bcrypt.hash(accountPlaceholder, 12);

          const parsedPhone = userData.phone
            ? parsePhoneNumber(userData.phone)
            : null;
          const countryCode = parsedPhone?.countryCode || "91";
          const localPhone = parsedPhone?.localNumber || userData.phone;

          const normalizedLocation = userData.location
            ? userData.location
                .trim()
                .replace(/\s+/g, " ")
                .split(" ")
                .map(
                  word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join(" ")
            : null;
          if (normalizedLocation && normalizedLocation.length > 255) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "Location cannot exceed 255 characters",
            });
            continue;
          }

          await prisma.user.create({
            data: {
              firstName: userData.firstName.trim(),
              lastName: userData.lastName.trim(),
              email: normalizedEmail,
              phone: localPhone || null,
              countryCode,
              passwordHash,
              mustChangePassword: true,
              role,
              region,
              location: normalizedLocation,
            },
          });

          let invitationEmailSent = false;
          if (shouldSendInvitationEmail(role)) {
            const fullName =
              `${userData.firstName} ${userData.lastName}`.trim();
            try {
              invitationEmailSent = await emailService.sendUserInvitationEmail({
                name: fullName,
                email: normalizedEmail,
                role,
              });
            } catch (error) {
              logError("user_import_invitation_failed", error, { row: rowNum });
            }
          }

          results.success.push({
            row: rowNum,
            email: normalizedEmail,
            firstName: userData.firstName,
            lastName: userData.lastName,
            invitationEmailSent,
          });
        } catch (error) {
          logError("user_import_row_failed", error, { row: rowNum });
          results.errors.push({
            row: rowNum,
            email: userData.email || "N/A",
            error: importFailureMessage(error),
          });
        }
      }

      res.status(200).json({
        message: `Import completed. ${results.success.length} users created, ${results.errors.length} errors.`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error) {
      handleError(error, res, "Import users");
    }
  }

  async getImportTemplate(req: Request, res: Response) {
    res.json({
      columns: [
        { name: "firstName", label: "First Name", required: true },
        { name: "lastName", label: "Last Name", required: true },
        {
          name: "phone",
          label: "Phone Number",
          required: false,
          format: "10 digits",
        },
        { name: "email", label: "Email", required: true },
        {
          name: "role",
          label: "Role",
          required: false,
          options: VALID_ROLES,
          default: "SALES",
        },
        {
          name: "region",
          label: "Region",
          required: false,
          options: VALID_REGIONS,
          default: DEFAULT_REGION,
        },
      ],
      validRoles: VALID_ROLES,
      validRegions: VALID_REGIONS,
      defaultRegion: DEFAULT_REGION,
    });
  }

  async downloadTemplate(req: Request, res: Response) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Users");

      sheet.columns = [
        { header: "First Name", key: "firstName", width: 20 },
        { header: "Last Name", key: "lastName", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Role", key: "role", width: 15 },
        { header: "Region", key: "region", width: 15 },
        { header: "Location", key: "location", width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      const roleValidation: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${VALID_ROLES.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Role",
        error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
      };

      const regionValidation: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${VALID_REGIONS.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Region",
        error: `Region must be one of: ${VALID_REGIONS.join(", ")}`,
      };

      for (let row = 2; row <= 1000; row++) {
        sheet.getCell(`E${row}`).dataValidation = roleValidation;
        sheet.getCell(`F${row}`).dataValidation = regionValidation;
      }

      sheet.addRow({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "9876543210",
        role: "SALES",
        region: "SOUTH",
        location: "Mumbai",
      });

      const instructionsSheet = workbook.addWorksheet("Instructions");
      instructionsSheet.columns = [
        { header: "Instructions", key: "instruction", width: 80 },
      ];
      instructionsSheet.addRows([
        { instruction: "User Import Template Instructions" },
        { instruction: "" },
        { instruction: "Required Fields:" },
        { instruction: "  - First Name: User's first name (required)" },
        { instruction: "  - Last Name: User's last name (required)" },
        {
          instruction:
            "  - Email: Valid email address (required, must be unique)",
        },
        { instruction: "" },
        { instruction: "Optional Fields:" },
        { instruction: "  - Phone: 10-digit phone number" },
        {
          instruction: `  - Role: ${VALID_ROLES.join(" or ")} (defaults to SALES)`,
        },
        {
          instruction: `  - Region: ${VALID_REGIONS.join(", ")} (defaults to ${DEFAULT_REGION})`,
        },
        { instruction: "  - Location: User's location/city (optional)" },
        { instruction: "" },
        { instruction: "Notes:" },
        { instruction: "  - Delete the example row before importing" },
        {
          instruction:
            "  - Role and Region columns have dropdown lists for valid values",
        },
        {
          instruction:
            "  - Each user receives an invitation to set a private password",
        },
      ]);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="users-import-template.xlsx"'
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      handleError(error, res, "Download template");
    }
  }

  async downloadTemplateCsv(req: Request, res: Response) {
    try {
      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Role",
        "Region",
        "Location",
      ];
      const exampleRow = [
        "John",
        "Doe",
        "john.doe@example.com",
        "9876543210",
        "SALES",
        "SOUTH",
        "Mumbai",
      ];
      const instructions = [
        "# Instructions:",
        "# - Required fields: First Name, Last Name, Email",
        "# - Optional fields: Phone (10 digits), Role, Region, Location",
        `# - Role options: ${VALID_ROLES.join(", ")} (default: SALES)`,
        `# - Region options: ${VALID_REGIONS.join(", ")} (default: ${DEFAULT_REGION})`,
        "# - Delete these instruction lines and the example row before importing",
        "",
      ];

      const csvContent = [
        ...instructions,
        headers.join(","),
        exampleRow.join(","),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="users-import-template.csv"'
      );
      res.send("\uFEFF" + csvContent);
    } catch (error) {
      handleError(error, res, "Download CSV template");
    }
  }

  private detectFileType(file: UploadedImportFile): "xlsx" | "csv" | null {
    const filename = file.originalname.toLowerCase();
    if (filename.endsWith(".csv")) {
      return file.buffer.subarray(0, 1_024).includes(0) ? null : "csv";
    }
    if (filename.endsWith(".xlsx")) {
      const signature = file.buffer.subarray(0, 4).toString("hex");
      return ["504b0304", "504b0506", "504b0708"].includes(signature)
        ? "xlsx"
        : null;
    }
    return null;
  }

  private parseCsvFile(buffer: Buffer): {
    headerMap: Record<string, number>;
    rows: unknown[][];
  } {
    const parsed: unknown = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      max_record_size: 10_000,
    });

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Empty CSV file");
    }
    if (parsed.length > MAX_IMPORT_ROWS + 1) {
      throw new Error(`A single import cannot exceed ${MAX_IMPORT_ROWS} users`);
    }
    if (!parsed.every(record => Array.isArray(record) && record.length <= 50)) {
      throw new Error("CSV rows must contain at most 50 columns");
    }
    const records = parsed as unknown[][];

    const headerRow = records[0];
    if (!headerRow) throw new Error("CSV header row is required");
    const headerMap: Record<string, number> = {};
    headerRow.forEach((header, index) => {
      const normalized = String(header || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      headerMap[normalized] = index;
    });

    return { headerMap, rows: records.slice(1) };
  }

  async importUsersFile(req: Request, res: Response) {
    try {
      const file = (req as Request & { file?: UploadedImportFile }).file;
      if (!file) {
        return handleValidationError(
          res,
          "No file uploaded",
          "file",
          "Import users"
        );
      }

      const fileType = this.detectFileType(file);
      if (fileType === null) {
        return handleValidationError(
          res,
          "Unsupported file format. Please use .xlsx or .csv",
          "file",
          "Import users"
        );
      }

      let headerMap: Record<string, number> = {};
      let rows: unknown[][] = [];

      if (fileType === "csv") {
        const parsed = this.parseCsvFile(file.buffer);
        headerMap = parsed.headerMap;
        rows = parsed.rows;
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(
          file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
        );
        const ws = workbook.worksheets[0];
        if (!ws) {
          return handleValidationError(
            res,
            "Empty workbook",
            "file",
            "Import users"
          );
        }
        if (ws.rowCount - 1 > MAX_IMPORT_ROWS) {
          return handleValidationError(
            res,
            `A single import cannot exceed ${MAX_IMPORT_ROWS} users`,
            "file",
            "Import users"
          );
        }
        if (ws.columnCount > 50) {
          return handleValidationError(
            res,
            "Import files cannot contain more than 50 columns",
            "file",
            "Import users"
          );
        }

        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          const header = String(cell.value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
          headerMap[header] = colNumber - 1;
        });

        for (let r = 2; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const rowData: unknown[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowData[colNumber - 1] = cell.text.trim();
          });
          if (rowData.some(v => v)) rows.push(rowData);
        }
      }

      const getCol = (keys: string[]): number => {
        for (const key of keys) {
          if (headerMap[key] !== undefined) return headerMap[key];
        }
        return -1;
      };

      const firstNameCol = getCol(["firstname", "first name", "first_name"]);
      const lastNameCol = getCol(["lastname", "last name", "last_name"]);
      const emailCol = getCol(["email", "emailaddress", "email address"]);
      const phoneCol = getCol([
        "phone",
        "phonenumber",
        "phone number",
        "mobile",
      ]);
      const roleCol = getCol(["role"]);
      const regionCol = getCol(["region"]);
      const locationCol = getCol(["location"]);
      if (firstNameCol < 0 || lastNameCol < 0 || emailCol < 0) {
        return handleValidationError(
          res,
          "The file must contain First Name, Last Name, and Email columns",
          "file",
          "Import users"
        );
      }

      const getRowText = (row: unknown[], column: number): string =>
        column >= 0 ? String(row[column] ?? "").trim() : "";

      const results = {
        success: [] as ImportedUserResult[],
        errors: [] as {
          row: number;
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          role: string;
          region: string;
          location: string;
          error: string;
        }[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const rowNum = i + 2;

        const firstName = getRowText(row, firstNameCol);
        const lastName = getRowText(row, lastNameCol);
        const email = getRowText(row, emailCol).toLowerCase();
        const phone = getRowText(row, phoneCol);
        const role =
          roleCol >= 0
            ? (getRowText(row, roleCol) || "SALES").toUpperCase()
            : "SALES";
        const region =
          regionCol >= 0
            ? getRowText(row, regionCol).toUpperCase().replace(/\s+/g, "_")
            : "";

        const rawLocation = getRowText(row, locationCol);
        const location = rawLocation
          ? rawLocation
              .replace(/\s+/g, " ")
              .split(" ")
              .map(
                (word: string) =>
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join(" ")
          : "";

        const errorRow = {
          row: rowNum,
          firstName,
          lastName,
          email,
          phone,
          role,
          region,
          location,
          error: "",
        };

        if (!isValidName(firstName) || !isValidName(lastName) || !email) {
          errorRow.error = "First name, last name, and email are required";
          results.errors.push(errorRow);
          continue;
        }

        if (!isValidEmail(email)) {
          errorRow.error = "Invalid email format";
          results.errors.push(errorRow);
          continue;
        }
        if (location.length > 255) {
          errorRow.error = "Location cannot exceed 255 characters";
          results.errors.push(errorRow);
          continue;
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          errorRow.error = "User with this email already exists";
          results.errors.push(errorRow);
          continue;
        }

        if (phone && !isValidPhone(phone)) {
          errorRow.error = "Invalid phone number format (must be 10 digits)";
          results.errors.push(errorRow);
          continue;
        }

        if (!VALID_ROLES.includes(role)) {
          errorRow.error = `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`;
          results.errors.push(errorRow);
          continue;
        }

        let finalRegion: Region | null = null;
        if (region) {
          if (VALID_REGIONS.includes(region)) {
            finalRegion = region as Region;
          } else {
            errorRow.error = `Invalid region. Must be one of: ${VALID_REGIONS.join(", ")}`;
            results.errors.push(errorRow);
            continue;
          }
        } else {
          finalRegion = DEFAULT_REGION as Region;
        }

        try {
          const accountPlaceholder = generateAccountPlaceholder();
          const passwordHash = await bcrypt.hash(accountPlaceholder, 12);

          const parsedPhone = phone ? parsePhoneNumber(phone) : null;
          const countryCode = parsedPhone?.countryCode || "91";
          const localPhone = parsedPhone?.localNumber || phone;

          await prisma.user.create({
            data: {
              firstName,
              lastName,
              email,
              phone: localPhone || null,
              countryCode,
              passwordHash,
              mustChangePassword: true,
              role: role as UserRole,
              region: finalRegion,
              location: location || null,
            },
          });

          let invitationEmailSent = false;
          if (shouldSendInvitationEmail(role as UserRole)) {
            const fullName = `${firstName} ${lastName}`.trim();
            try {
              invitationEmailSent = await emailService.sendUserInvitationEmail({
                name: fullName,
                email,
                role,
              });
            } catch (error) {
              logError("user_file_import_invitation_failed", error, {
                row: rowNum,
              });
            }
          }

          results.success.push({
            row: rowNum,
            email,
            firstName,
            lastName,
            invitationEmailSent,
          });
        } catch (error) {
          logError("user_file_import_row_failed", error, { row: rowNum });
          errorRow.error = importFailureMessage(error);
          results.errors.push(errorRow);
        }
      }

      let report:
        | { filename: string; mimeType: string; base64: string }
        | undefined;
      if (results.errors.length > 0) {
        const reportWb = new ExcelJS.Workbook();
        const errorSheet = reportWb.addWorksheet("Failed Imports");
        errorSheet.columns = [
          { header: "Row", key: "row", width: 8 },
          { header: "First Name", key: "firstName", width: 20 },
          { header: "Last Name", key: "lastName", width: 20 },
          { header: "Email", key: "email", width: 30 },
          { header: "Phone", key: "phone", width: 15 },
          { header: "Role", key: "role", width: 15 },
          { header: "Location", key: "location", width: 20 },
          { header: "Region", key: "region", width: 15 },
          { header: "Error Reason", key: "error", width: 50 },
        ];

        const headerRow = errorSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFCCCC" },
        };

        results.errors.forEach(err => errorSheet.addRow(err));

        const buffer = await reportWb.xlsx.writeBuffer();
        const ts = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`;

        report = {
          filename: `failed-user-imports-${stamp}.xlsx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: Buffer.from(buffer).toString("base64"),
        };
      }

      res.json({
        message: `Import completed. ${results.success.length} users created, ${results.errors.length} errors.`,
        success: results.success,
        errors: results.errors,
        report,
      });
    } catch (error) {
      handleError(error, res, "Import users file");
    }
  }
}
