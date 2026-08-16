import { Request, Response } from "express";
import ExcelJS from "exceljs";
import { prisma, LeadStatus, LeadSource } from "@repo/db";
import { handleError, handleValidationError } from "../utils/errorHandler.js";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { buildFullName, splitFullName } from "../utils/nameHelpers.js";
import {
  isValidNameForImport,
  isValidPhoneForImport,
  isValidEmailForImport,
  isValidPincodeForImport,
  isValidCompanyForImport,
} from "../utils/validators.js";

const MAX_IMPORT_ROWS = 1000;
const IMPORT_STATUSES = new Set<LeadStatus>(Object.values(LeadStatus));

export class LeadsImportController {
  private getTemplateHeaders(): string[] {
    return [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company Name",
      "City",
      "State",
      "Pincode",
      "Status",
    ];
  }

  async downloadTemplate(req: Request, res: Response) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ralli Wolf CRM";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Lead Import");
    const headers = this.getTemplateHeaders();
    sheet.columns = headers.map(header => ({
      header,
      key: header.toLowerCase().replace(/\s+/g, ""),
      width: header === "Email" || header === "Company Name" ? 28 : 18,
    }));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "I1" };
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFED1C24" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    sheet.getColumn(4).numFmt = "@";
    sheet.getColumn(8).numFmt = "@";
    sheet.getCell("I2").dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"OPEN,WORKING,QUALIFIED,UNQUALIFIED,NURTURING,CONVERTED"'],
    };

    const exampleSheet = workbook.addWorksheet("Example");
    exampleSheet.columns = sheet.columns.map(column => ({
      header: column.header as string,
      key: column.key,
      width: column.width,
    }));
    exampleSheet.addRow({
      firstname: "Aarav",
      lastname: "Mehta",
      email: "aarav.mehta@example.com",
      phone: "9876543210",
      companyname: "Summit Engineering Pvt Ltd",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      status: "QUALIFIED",
    });
    exampleSheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFED1C24" },
      };
    });
    exampleSheet.getRow(2).font = {
      color: { argb: "FF64748B" },
      italic: true,
    };
    exampleSheet.getColumn(4).numFmt = "@";
    exampleSheet.getColumn(8).numFmt = "@";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="leads-template.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  async downloadTemplateCsv(req: Request, res: Response) {
    const headers = this.getTemplateHeaders();
    const csvContent = stringify([headers], {
      header: false,
      quoted: true,
      quoted_empty: true,
      bom: true,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="leads-template.csv"`
    );
    res.send(csvContent);
  }

  private detectFileType(file: Express.Multer.File): "xlsx" | "csv" {
    const filename = file.originalname || "";
    const mimetype = file.mimetype || "";

    // Check by extension first
    if (filename.toLowerCase().endsWith(".csv")) {
      return "csv";
    }
    if (filename.toLowerCase().endsWith(".xlsx")) {
      return "xlsx";
    }

    // Check by MIME type
    if (mimetype === "text/csv" || mimetype === "application/csv") {
      return "csv";
    }
    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return "xlsx";
    }

    // Default to xlsx for backward compatibility
    return "xlsx";
  }

  private parseCsvFile(buffer: Buffer): {
    headerMap: Record<string, number>;
    rows: unknown[][];
  } {
    const records = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as unknown[][];

    if (records.length === 0) {
      throw new Error("Empty CSV file");
    }

    const headerRow = records[0] || [];
    const headerMap: Record<string, number> = {};
    headerRow.forEach((header, index) => {
      const normalized = String(header || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      headerMap[normalized] = index + 1; // 1-based like Excel
    });

    return {
      headerMap,
      rows: records.slice(1), // Skip header row
    };
  }

  /**
   * Validate lead fields according to import rules
   * Returns an array of error messages (empty if all validations pass)
   */
  private validateLeadFields(
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    companyName: string,
    pincode: string
  ): string[] {
    const errors: string[] = [];

    // Validate First Name - must be non-numeric string
    if (!isValidNameForImport(firstName)) {
      errors.push("First Name must be a non-numeric string");
    }

    // Validate Last Name - must be non-numeric string if provided
    if (lastName && !isValidNameForImport(lastName)) {
      errors.push("Last Name must be a non-numeric string");
    }

    // Validate Phone - must be exactly 10 digits if provided
    if (phone && !isValidPhoneForImport(phone)) {
      errors.push("Phone Number must be exactly 10 digits");
    }

    // Validate Email - must be valid email format if provided
    if (email && !isValidEmailForImport(email)) {
      errors.push("Email must be a valid email address");
    }

    // Validate Company - must be valid string if provided
    if (companyName && !isValidCompanyForImport(companyName)) {
      errors.push("Company must be a valid string");
    }

    // Validate Pincode - must be exactly 6 digits if provided
    if (pincode && !isValidPincodeForImport(pincode)) {
      errors.push("Pincode must be exactly 6 digits");
    }

    return errors;
  }

  async importLeads(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return handleValidationError(
          res,
          "No file uploaded",
          "file",
          "Import leads"
        );
      }

      const fileType = this.detectFileType(file);
      if (!["xlsx", "csv"].includes(fileType)) {
        return handleValidationError(
          res,
          "Unsupported file format. Please use .xlsx or .csv",
          "file",
          "Import leads"
        );
      }

      let headerMap: Record<string, number> = {};
      let rowCount = 0;
      let getCell: (row: number, key: string) => string;

      if (fileType === "csv") {
        const { headerMap: csvHeaderMap, rows } = this.parseCsvFile(
          file.buffer
        );
        headerMap = csvHeaderMap;
        rowCount = rows.length + 1; // +1 for header row

        getCell = (row: number, key: string) => {
          const col = headerMap[key];
          if (col == null || row < 2) return ""; // Row 1 is header
          const rowIndex = row - 2; // Convert to 0-based index
          if (rowIndex < 0 || rowIndex >= rows.length) return "";
          const rowData = rows[rowIndex];
          if (!rowData) return "";
          const cellIndex = col - 1; // Convert to 0-based index
          if (cellIndex < 0 || cellIndex >= rowData.length) return "";
          const val = rowData[cellIndex];
          return val == null ? "" : String(val).trim();
        };
      } else {
        // Excel parsing
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
            "Import leads"
          );
        }

        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          const header = String(cell.value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
          headerMap[header] = colNumber;
        });

        const normalizeCellValue = (val: ExcelJS.CellValue): string => {
          if (val == null) return "";
          if (typeof val === "string") return val.trim();
          if (typeof val === "number") return String(val);
          if (val instanceof Date) return val.toISOString();
          // ExcelJS hyperlink object: { text: string, hyperlink: string }
          if (typeof val === "object" && "text" in val) {
            const text = (val as { text?: unknown }).text;
            if (typeof text === "string") return text.trim();
          }
          // ExcelJS rich text: { richText: [{ text: string, ... }] }
          if (typeof val === "object" && "richText" in val) {
            const richText = (val as { richText?: Array<{ text?: string }> })
              .richText;
            if (!Array.isArray(richText)) return "";
            return richText
              .map(run => run.text || "")
              .join("")
              .trim();
          }
          return "";
        };

        rowCount = ws.rowCount;
        getCell = (row: number, key: string) => {
          const col = headerMap[key];
          if (!col) return "";
          const val = ws.getRow(row).getCell(col).value;
          return normalizeCellValue(val);
        };
      }

      if (rowCount - 1 > MAX_IMPORT_ROWS) {
        return handleValidationError(
          res,
          `Import contains too many rows. The maximum is ${MAX_IMPORT_ROWS}.`,
          "file",
          "Import leads"
        );
      }

      let insertedCount = 0;
      let skippedDuplicates = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      const skippedRows: Array<{
        row: number;
        firstName: string;
        lastName: string;
        fullName: string;
        email: string;
        phone: string;
        companyName: string;
        city: string;
        state: string;
        pincode: string;
        status: string;
        reason: string;
      }> = [];

      const readCell = (row: number, ...keys: string[]) => {
        for (const key of keys) {
          const value = getCell(
            row,
            key.replace(/[^a-z0-9]/gi, "").toLowerCase()
          );
          if (value) return value;
        }
        return "";
      };

      // Resolve duplicates in two batched queries instead of issuing up to two
      // database requests for every spreadsheet row.
      const candidateEmails: string[] = [];
      const candidatePhones: string[] = [];
      for (let row = 2; row <= rowCount; row++) {
        const email = readCell(
          row,
          "email",
          "emailAddress",
          "workEmail"
        ).toLowerCase();
        const phone = readCell(
          row,
          "phone",
          "phoneNumber",
          "mobile",
          "mobileNumber",
          "contactNumber"
        )
          .replace(/^\+?91[\s-]?/, "")
          .replace(/[^0-9]/g, "");
        if (email) candidateEmails.push(email);
        if (phone) candidatePhones.push(phone);
      }
      const [emailMatches, phoneMatches] = await Promise.all([
        candidateEmails.length
          ? prisma.lead.findMany({
              where: { email: { in: [...new Set(candidateEmails)] } },
              select: { email: true },
            })
          : Promise.resolve([]),
        candidatePhones.length
          ? prisma.lead.findMany({
              where: { phone: { in: [...new Set(candidatePhones)] } },
              select: { phone: true },
            })
          : Promise.resolve([]),
      ]);
      const knownEmails = new Set(emailMatches.map(item => item.email));
      const knownPhones = new Set(
        phoneMatches.map(item => item.phone).filter(Boolean)
      );

      for (let r = 2; r <= rowCount; r++) {
        const read = (...keys: string[]) => readCell(r, ...keys);
        let firstName = read("firstName", "first", "givenName");
        let lastName = read("lastName", "surname", "familyName");
        const legacyName = read("name", "fullName", "contactName");

        if ((!firstName || !firstName.trim()) && legacyName) {
          const legacy = splitFullName(legacyName);
          firstName = legacy.firstName;
          if ((!lastName || !lastName.trim()) && legacy.lastName) {
            lastName = legacy.lastName;
          }
        }

        firstName = firstName?.trim() || "";
        lastName = lastName?.trim() || "";
        const fullName = buildFullName(firstName, lastName);

        const email = read("email", "emailAddress", "workEmail").toLowerCase();
        const phone = read(
          "phone",
          "phoneNumber",
          "mobile",
          "mobileNumber",
          "contactNumber"
        )
          .replace(/^\+?91[\s-]?/, "")
          .replace(/[^0-9]/g, "");
        const companyName = read(
          "companyName",
          "company",
          "organisation",
          "organization",
          "account"
        );
        const city = read("city", "town");
        const state = read("state", "province", "region");
        const pincode = read("pincode", "postalCode", "zipCode", "zip").replace(
          /[^0-9]/g,
          ""
        );
        const status = read("status", "leadStatus", "stage");

        if (
          ![
            firstName,
            lastName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
          ].some(Boolean)
        ) {
          continue;
        }

        // Field-level validation - check before duplicate checks to avoid unnecessary DB queries
        const validationErrors = this.validateLeadFields(
          firstName,
          lastName,
          email,
          phone,
          companyName,
          pincode
        );

        if (validationErrors.length > 0) {
          const reason = validationErrors.join("; ");
          errors.push({ row: r, reason });
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
          continue;
        }

        if (!email && !phone) {
          const reason = "Missing email and phone (one is required)";
          errors.push({ row: r, reason });
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
          continue;
        }

        // Duplicate check with specific reason
        if (email && knownEmails.has(email)) {
          skippedDuplicates++;
          const reason = `Duplicate email: ${email}`;
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
          continue;
        }
        if (phone && knownPhones.has(phone)) {
          skippedDuplicates++;
          const reason = `Duplicate phone: ${phone}`;
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
          continue;
        }

        // Validate enums
        // Force source to IMPORT for all imported leads
        const normalizedStatus = status.toUpperCase() as LeadStatus;
        if (status && !IMPORT_STATUSES.has(normalizedStatus)) {
          const reason = `Invalid status for row ${r}: status=${status}`;
          errors.push({ row: r, reason });
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
          continue;
        }
        const enumStatus = status ? normalizedStatus : LeadStatus.OPEN;

        try {
          const leadData = {
            firstName,
            lastName: lastName || null,
            email:
              email ||
              `${Date.now()}_${Math.random().toString(36).slice(2)}@placeholder.local`,
            phone: phone || null,
            companyName: companyName || null,
            city: city || null,
            state: state || null,
            pincode: pincode || null,
            source: LeadSource.IMPORT,
            status: enumStatus,
          };

          if (enumStatus === LeadStatus.CONVERTED && email) {
            await prisma.$transaction(async transaction => {
              const account = companyName
                ? await transaction.account.upsert({
                    where: { name: companyName },
                    update: {},
                    create: { name: companyName },
                  })
                : null;
              const contact = await transaction.contact.upsert({
                where: { email },
                update: {
                  name: fullName,
                  phone: phone || null,
                  ...(account ? { accountId: account.id } : {}),
                },
                create: {
                  name: fullName,
                  email,
                  phone: phone || null,
                  ...(account ? { accountId: account.id } : {}),
                },
              });
              await transaction.lead.create({
                data: { ...leadData, convertedToContactId: contact.id },
              });
            });
          } else {
            await prisma.lead.create({ data: leadData });
          }

          insertedCount++;
          if (email) knownEmails.add(email);
          if (phone) knownPhones.add(phone);
        } catch (e) {
          const reason = `Insert failed: ${e instanceof Error ? e.message : "unknown error"}`;
          errors.push({ row: r, reason });
          skippedRows.push({
            row: r,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            companyName,
            city,
            state,
            pincode,
            status,
            reason,
          });
        }
      }

      // If there are skipped rows or errors, build an Excel report and return it as base64
      let report:
        | { filename: string; mimeType: string; base64: string }
        | undefined;
      if (skippedRows.length > 0 || errors.length > 0) {
        const reportWb = new ExcelJS.Workbook();
        const skippedSheet = reportWb.addWorksheet("Skipped");
        skippedSheet.columns = [
          { header: "Row", key: "row" },
          { header: "First Name", key: "firstName" },
          { header: "Last Name", key: "lastName" },
          { header: "Full Name", key: "fullName" },
          { header: "Email", key: "email" },
          { header: "Phone", key: "phone" },
          { header: "Company Name", key: "companyName" },
          { header: "City", key: "city" },
          { header: "State", key: "state" },
          { header: "Pincode", key: "pincode" },
          { header: "Status", key: "status" },
          { header: "Reason", key: "reason" },
        ];
        skippedRows.forEach(s => skippedSheet.addRow(s));

        if (errors.length > 0) {
          const errorsSheet = reportWb.addWorksheet("Errors");
          errorsSheet.columns = [
            { header: "Row", key: "row" },
            { header: "Reason", key: "reason" },
          ];
          errors.forEach(e => errorsSheet.addRow(e));
        }

        const buffer = await reportWb.xlsx.writeBuffer();
        const ts = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
        report = {
          filename: `skipped-leads-report-${stamp}.xlsx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: Buffer.from(buffer).toString("base64"),
        };
      }

      res.json({
        insertedCount,
        skippedDuplicates,
        skippedCount: skippedRows.length - skippedDuplicates,
        errors,
        report,
      });
    } catch (error) {
      handleError(error, res, "Import leads");
    }
  }
}
