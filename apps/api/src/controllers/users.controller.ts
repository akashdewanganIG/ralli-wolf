import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { UserRole, Region } from "@prisma/client";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { generateUserPassword } from "../utils/password.utils.js";
import { emailService } from "../services/email.service.js";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  validateRequiredFields,
} from "../utils/errorHandler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
} from "../utils/validators.js";
import { parsePhoneNumber } from "../utils/phoneHelper.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import { isPermission } from "@repo/db/permissions";

// Valid regions for import
const VALID_REGIONS = ["SOUTH", "NORTH", "EAST", "WEST_1", "WEST_2", "APTOC"];
const VALID_ROLES = ["ADMIN", "SALES"];
/** Roles an admin may assign through the API. */
const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.CUSTOM,
];
const DEFAULT_REGION = "SOUTH";

// Every dashboard account needs a usable sign-in path, whatever its role.
const shouldSendCredentialEmail = (_role: UserRole) => true;

export class UserController {
  async getAllUsers(req: Request, res: Response) {
    try {
      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      // Validate page parameter
      const page = Math.max(1, parseInt(pageParam) || 1);

      // Validate limit parameter with custom support
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      // Calculate pagination offset
      const skip = (page - 1) * limit;

      const { role, region } = req.query;
      const developerEmail =
        process.env.DEVELOPER_LOGIN_EMAIL?.trim() || undefined;
      const developerName =
        process.env.DEVELOPER_LOGIN_NAME?.trim() || "Developer Access";

      // Build where clause based on query params
      const whereClause: any = {
        deletedAt: null, // Exclude soft-deleted users
      };
      if (role) {
        whereClause.role = role as UserRole;
      }
      if (region) {
        whereClause.region = region as Region;
      }
      // Hide only the configured developer account. Company-domain users are
      // legitimate managed accounts and must remain visible after creation.
      const andFilters: any[] = [];

      if (developerEmail) {
        andFilters.push({
          NOT: [
            {
              email: {
                equals: developerEmail,
                mode: "insensitive",
              },
            },
            {
              AND: [
                { role: UserRole.ADMIN },
                { firstName: { equals: developerName, mode: "insensitive" } },
              ],
            },
          ],
        } as any);
      } else {
        // If email is not configured, still attempt to hide the conventional developer account by name + role
        andFilters.push({
          NOT: {
            AND: [
              { role: UserRole.ADMIN },
              { firstName: { equals: developerName, mode: "insensitive" } },
            ],
          },
        } as any);
      }
      if (andFilters.length > 0) {
        whereClause.AND = andFilters;
      }

      // Execute count query with filters
      const totalItems = await prisma.user.count({ where: whereClause });

      // Execute paginated query with filters
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

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Return standardized pagination response
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

      // Validate required fields (region is optional for all users)
      const requiredFields = ["firstName", "lastName", "email", "role"];
      if (
        !validateRequiredFields(req.body, requiredFields, res, "Create user")
      ) {
        return;
      }

      // Normalize email: trim whitespace and convert to lowercase for consistent storage
      const normalizedEmail = email.trim().toLowerCase();

      // Validate firstName
      if (!isValidName(firstName)) {
        return handleValidationError(
          res,
          "First name is required and must be non-empty (max 255 characters)",
          "firstName",
          "Create user"
        );
      }

      // Validate lastName
      if (!isValidName(lastName)) {
        return handleValidationError(
          res,
          "Last name is required and must be non-empty (max 255 characters)",
          "lastName",
          "Create user"
        );
      }

      // Validate email format (use original email for validation message)
      if (!isValidEmail(normalizedEmail)) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Create user"
        );
      }

      // Validate phone if provided
      if (phone && !isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Create user"
        );
      }

      // Validate region (optional for all users)
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

      // Validate the role and its permission list. ADMIN and SALES resolve
      // their permissions from the catalogue; only CUSTOM stores its own.
      // (The old "only one System Admin" rule is gone with that tier: ADMIN is
      // now an ordinary role that any number of accounts can hold.)
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

      // Check if user with this email already exists (use normalized email)
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

      // Generate random password
      const generatedPassword = generateUserPassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);

      // Parse phone number to extract country code
      const parsedPhone = phone ? parsePhoneNumber(phone) : null;
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      // Normalize location: trim, remove extra spaces, and capitalize each word
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

      // Create user (store normalized email)
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone: localPhone,
          countryCode,
          passwordHash,
          // The generated password goes out by email in plaintext, so it is
          // good for exactly one sign-in and must then be replaced.
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

      const sendCredentialEmail = shouldSendCredentialEmail(role as UserRole);

      let credentialEmailSent = false;

      // Every dashboard user needs a usable sign-in path, including Sales.
      // Await delivery so the client never claims an email was sent when the
      // provider rejected it. The account itself remains created either way.
      if (sendCredentialEmail) {
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        try {
          credentialEmailSent = await emailService.sendUserCreationEmail({
            name: fullName,
            email: normalizedEmail,
            password: generatedPassword,
            role,
          });
        } catch (error) {
          console.error("Failed to send user creation email:", error);
        }
      }

      // Return user data (without password hash)
      res.status(201).json({
        ...user,
        credentialEmailSent,
        message: credentialEmailSent
          ? "User created successfully. Login credentials were sent by email."
          : "User created successfully, but the credential email could not be delivered. They can still use Email code on the login page.",
      });
    } catch (error) {
      handleError(error, res, "Create user");
    }
  }

  /**
   * Re-issue an account's sign-in credentials and email them.
   * POST /api/users/:id/resend-credentials
   *
   * The stored password is a bcrypt hash, so the original cannot be recovered
   * and re-sent. This mints a fresh one instead, which also makes the action
   * safe to use when the first email went to the wrong place: whatever was in
   * that message stops working the moment this succeeds.
   */
  async resendCredentials(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = Number(id);
      if (!id || Number.isNaN(userId)) {
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

      const generatedPassword = generateUserPassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);

      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

      // Send first, then persist. If the provider rejects the message the old
      // password keeps working, which beats silently locking the user out.
      const emailSent = await emailService.sendUserCreationEmail({
        name: fullName,
        email: user.email,
        password: generatedPassword,
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
        data: { passwordHash, mustChangePassword: true },
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
        message: `New sign-in credentials were sent to ${user.email}.`,
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

      const userId = parseInt(id);
      if (isNaN(userId)) {
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

      // `include` returns every scalar, which would put the bcrypt hash on the
      // wire. Nothing needs it, so drop it before responding.
      const { passwordHash: _passwordHash, ...safeUser } = user;
      res.json(safeUser);
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

      const userId = parseInt(id);
      if (isNaN(userId)) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Update user"
        );
      }

      const updateData = { ...req.body };

      // Role and permissions are editable: a person's responsibilities change,
      // and re-creating the account to reflect that would lose their history.
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
          // ADMIN and SALES resolve from the catalogue, so a stale stored list
          // would be dead weight that reappears if the role flips back.
          updateData.permissions = [];
        }
      } else if (updateData.permissions !== undefined) {
        // Permissions sent without a role only make sense for a CUSTOM account.
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

      // Validate firstName if being updated
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

      // Validate lastName if being updated
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

      // Validate email format if email is being updated
      if (updateData.email !== undefined && !isValidEmail(updateData.email)) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Update user"
        );
      }

      // Validate phone if being updated
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

      // Validate region if being updated (convert empty string to null for optional region)
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

      // Parse phone number to extract country code if phone is being updated
      if (updateData.phone) {
        const parsedPhone = parsePhoneNumber(updateData.phone);
        if (parsedPhone) {
          updateData.phone = parsedPhone.localNumber;
          updateData.countryCode = parsedPhone.countryCode;
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      res.json(user);
    } catch (error: any) {
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

      const userId = parseInt(id);
      if (isNaN(userId)) {
        return handleValidationError(
          res,
          "User ID must be a valid number",
          "id",
          "Delete user"
        );
      }

      // Soft delete: set deletedAt and deletedBy
      await prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          deletedBy: req.user?.id,
        },
      });

      res.status(204).send();
    } catch (error: any) {
      handleError(error, res, "Delete user");
    }
  }

  /**
   * Import users from CSV/Excel data
   * POST /api/users/import
   */
  async importUsers(req: Request, res: Response) {
    try {
      const { users: usersData } = req.body as {
        users: Array<{
          firstName: string;
          lastName: string;
          phone: string;
          email: string;
          role: string;
          region?: string;
          location?: string;
        }>;
      };

      if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        return handleValidationError(
          res,
          "Users data is required",
          "users",
          "Import users"
        );
      }

      const results = {
        success: [] as any[],
        errors: [] as { row: number; email: string; error: string }[],
      };

      for (let i = 0; i < usersData.length; i++) {
        const userData = usersData[i];
        const rowNum = i + 1;

        if (!userData) {
          results.errors.push({
            row: rowNum,
            email: "N/A",
            error: "Invalid row data",
          });
          continue;
        }

        try {
          // Validate required fields
          if (!userData.firstName || !userData.lastName || !userData.email) {
            results.errors.push({
              row: rowNum,
              email: userData.email || "N/A",
              error: "First name, last name, and email are required",
            });
            continue;
          }

          // Validate email
          const normalizedEmail = userData.email.trim().toLowerCase();
          if (!isValidEmail(normalizedEmail)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "Invalid email format",
            });
            continue;
          }

          // Check if user already exists
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

          // Validate phone if provided
          if (userData.phone && !isValidPhone(userData.phone)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: "Invalid phone number format",
            });
            continue;
          }

          // Validate and normalize role
          const role = (userData.role?.toUpperCase() || "SALES") as UserRole;
          if (!VALID_ROLES.includes(role)) {
            results.errors.push({
              row: rowNum,
              email: userData.email,
              error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
            });
            continue;
          }

          // Validate and normalize region
          let region: Region | null = null;
          if (userData.region) {
            const normalizedRegion = userData.region
              .toUpperCase()
              .replace(" ", "_");
            if (VALID_REGIONS.includes(normalizedRegion)) {
              region = normalizedRegion as Region;
            } else {
              region = DEFAULT_REGION as Region;
            }
          } else {
            region = DEFAULT_REGION as Region;
          }

          // Generate password
          const generatedPassword = generateUserPassword();
          const passwordHash = await bcrypt.hash(generatedPassword, 10);

          // Parse phone
          const parsedPhone = userData.phone
            ? parsePhoneNumber(userData.phone)
            : null;
          const countryCode = parsedPhone?.countryCode || "91";
          const localPhone = parsedPhone?.localNumber || userData.phone;

          // Normalize location
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

          // Create user
          await prisma.user.create({
            data: {
              firstName: userData.firstName.trim(),
              lastName: userData.lastName.trim(),
              email: normalizedEmail,
              phone: localPhone || null,
              countryCode,
              passwordHash,
              role,
              region,
              location: normalizedLocation,
            },
          });

          // Send welcome email (async)
          if (shouldSendCredentialEmail(role)) {
            const fullName =
              `${userData.firstName} ${userData.lastName}`.trim();
            emailService
              .sendUserCreationEmail({
                name: fullName,
                email: normalizedEmail,
                password: generatedPassword,
                role,
              })
              .catch(error => {
                console.error(
                  `Failed to send email to ${normalizedEmail}:`,
                  error
                );
              });
          }

          results.success.push({
            row: rowNum,
            email: normalizedEmail,
            firstName: userData.firstName,
            lastName: userData.lastName,
          });
        } catch (error: any) {
          results.errors.push({
            row: rowNum,
            email: userData.email || "N/A",
            error: error.message || "Unknown error",
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

  /**
   * Get import template info
   * GET /api/users/import/template
   */
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

  /**
   * Download Excel template with data validation (picklists for role and region)
   * GET /api/users/import/template/download
   */
  async downloadTemplate(req: Request, res: Response) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Users");

      // Define columns
      sheet.columns = [
        { header: "First Name", key: "firstName", width: 20 },
        { header: "Last Name", key: "lastName", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Role", key: "role", width: 15 },
        { header: "Region", key: "region", width: 15 },
        { header: "Location", key: "location", width: 20 },
      ];

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data validation (picklists) for Role column (E2:E1000)
      const roleValidation: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${VALID_ROLES.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Role",
        error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
      };

      // Add data validation for Region column (F2:F1000)
      const regionValidation: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${VALID_REGIONS.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Region",
        error: `Region must be one of: ${VALID_REGIONS.join(", ")}`,
      };

      // Apply validation to rows 2-1000
      for (let row = 2; row <= 1000; row++) {
        sheet.getCell(`E${row}`).dataValidation = roleValidation;
        sheet.getCell(`F${row}`).dataValidation = regionValidation;
      }

      // Add example row
      sheet.addRow({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "9876543210",
        role: "SALES",
        region: "SOUTH",
        location: "Mumbai",
      });

      // Add instructions sheet
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
            "  - A random password will be generated and emailed to each user",
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

  /**
   * Download CSV template
   * GET /api/users/import/template/download/csv
   */
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
      res.send("\uFEFF" + csvContent); // BOM for Excel compatibility
    } catch (error) {
      handleError(error, res, "Download CSV template");
    }
  }

  /**
   * Detect file type from uploaded file
   */
  private detectFileType(file: any): "xlsx" | "csv" {
    const filename = file.originalname || "";
    const mimetype = file.mimetype || "";

    if (filename.toLowerCase().endsWith(".csv")) return "csv";
    if (filename.toLowerCase().endsWith(".xlsx")) return "xlsx";
    if (mimetype === "text/csv" || mimetype === "application/csv") return "csv";
    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
      return "xlsx";

    return "xlsx";
  }

  /**
   * Parse CSV file
   */
  private parseCsvFile(buffer: Buffer): {
    headerMap: Record<string, number>;
    rows: any[][];
  } {
    const records = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (records.length === 0) {
      throw new Error("Empty CSV file");
    }

    const headerRow = records[0];
    const headerMap: Record<string, number> = {};
    headerRow.forEach((header: string, index: number) => {
      const normalized = String(header || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      headerMap[normalized] = index;
    });

    return { headerMap, rows: records.slice(1) };
  }

  /**
   * Import users from file upload (CSV or Excel)
   * POST /api/users/import/file
   */
  async importUsersFile(req: Request, res: Response) {
    try {
      const file = (req as any).file as any | undefined;
      if (!file) {
        return handleValidationError(
          res,
          "No file uploaded",
          "file",
          "Import users"
        );
      }

      const fileType = this.detectFileType(file);
      if (!["xlsx", "csv"].includes(fileType)) {
        return handleValidationError(
          res,
          "Unsupported file format. Please use .xlsx or .csv",
          "file",
          "Import users"
        );
      }

      let headerMap: Record<string, number> = {};
      let rows: any[][] = [];

      if (fileType === "csv") {
        const parsed = this.parseCsvFile(file.buffer);
        headerMap = parsed.headerMap;
        rows = parsed.rows;
      } else {
        // Excel parsing
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        const ws = workbook.worksheets[0];
        if (!ws) {
          return handleValidationError(
            res,
            "Empty workbook",
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
          headerMap[header] = colNumber - 1; // 0-based index
        });

        // Collect all rows
        for (let r = 2; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const rowData: any[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            let val = cell.value;
            if (val == null) val = "";
            else if (typeof val === "object" && "text" in val)
              val = (val as any).text;
            else if (typeof val === "object" && "richText" in val) {
              val = (val as any).richText
                .map((r: any) => r?.text || "")
                .join("");
            }
            rowData[colNumber - 1] = String(val).trim();
          });
          if (rowData.some(v => v)) rows.push(rowData);
        }
      }

      // Map header names to indices
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

      const results = {
        success: [] as any[],
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
        if (!row) continue; // Skip if row is undefined

        const rowNum = i + 2; // 1-based, accounting for header

        const firstName =
          firstNameCol >= 0 ? (row[firstNameCol] || "").trim() : "";
        const lastName =
          lastNameCol >= 0 ? (row[lastNameCol] || "").trim() : "";
        const email =
          emailCol >= 0 ? (row[emailCol] || "").trim().toLowerCase() : "";
        const phone = phoneCol >= 0 ? (row[phoneCol] || "").trim() : "";
        const role =
          roleCol >= 0
            ? (row[roleCol] || "SALES").trim().toUpperCase()
            : "SALES";
        const region =
          regionCol >= 0
            ? (row[regionCol] || "").trim().toUpperCase().replace(" ", "_")
            : "";
        // Normalize location: trim, remove extra spaces, and capitalize each word
        const rawLocation =
          locationCol >= 0 ? (row[locationCol] || "").trim() : "";
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

        // Validate required fields
        if (!firstName || !lastName || !email) {
          errorRow.error = "First name, last name, and email are required";
          results.errors.push(errorRow);
          continue;
        }

        // Validate email
        if (!isValidEmail(email)) {
          errorRow.error = "Invalid email format";
          results.errors.push(errorRow);
          continue;
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          errorRow.error = "User with this email already exists";
          results.errors.push(errorRow);
          continue;
        }

        // Validate phone if provided
        if (phone && !isValidPhone(phone)) {
          errorRow.error = "Invalid phone number format (must be 10 digits)";
          results.errors.push(errorRow);
          continue;
        }

        // Validate role
        if (!VALID_ROLES.includes(role)) {
          errorRow.error = `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`;
          results.errors.push(errorRow);
          continue;
        }

        // Validate and set region
        let finalRegion: Region | null = null;
        if (region) {
          if (VALID_REGIONS.includes(region)) {
            finalRegion = region as Region;
          } else {
            finalRegion = DEFAULT_REGION as Region;
          }
        } else {
          finalRegion = DEFAULT_REGION as Region;
        }

        try {
          // Generate password
          const generatedPassword = generateUserPassword();
          const passwordHash = await bcrypt.hash(generatedPassword, 10);

          // Parse phone
          const parsedPhone = phone ? parsePhoneNumber(phone) : null;
          const countryCode = parsedPhone?.countryCode || "91";
          const localPhone = parsedPhone?.localNumber || phone;

          // Create user
          await prisma.user.create({
            data: {
              firstName,
              lastName,
              email,
              phone: localPhone || null,
              countryCode,
              passwordHash,
              role: role as UserRole,
              region: finalRegion,
              location: location || null,
            },
          });

          // Send welcome email with password (async)
          if (shouldSendCredentialEmail(role as UserRole)) {
            const fullName = `${firstName} ${lastName}`.trim();
            emailService
              .sendUserCreationEmail({
                name: fullName,
                email,
                password: generatedPassword,
                role,
              })
              .catch(error => {
                console.error(`Failed to send email to ${email}:`, error);
              });
          }

          results.success.push({
            row: rowNum,
            email,
            firstName,
            lastName,
          });
        } catch (error: any) {
          errorRow.error = error.message || "Unknown error";
          results.errors.push(errorRow);
        }
      }

      // Generate error report if there are errors
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

        // Style header
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
