import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { stringify } from "csv-stringify/sync";
import { handleError, handleValidationError } from "../utils/errorHandler.js";
import { ExcelService, ExportEntity } from "../services/excel.service.js";
import { buildFullName } from "../utils/nameHelpers.js";
import { renderEmail } from "../services/emailTemplate.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_PAGE_COUNT = 50;
const EXPORT_ENTITIES: ExportEntity[] = ["leads", "contacts", "accounts"];

type ExportValue = string | number;
type ExportRow = Record<string, ExportValue>;
type ExportColumn = {
  header: string;
  key: string;
  text?: boolean;
};

const EXPORT_COLUMNS: Record<ExportEntity, ExportColumn[]> = {
  leads: [
    { header: "ID", key: "id" },
    { header: "First Name", key: "firstName" },
    { header: "Last Name", key: "lastName" },
    { header: "Full Name", key: "fullName" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone", text: true },
    { header: "Company Name", key: "companyName" },
    { header: "City", key: "city" },
    { header: "State", key: "state" },
    { header: "Pincode", key: "pincode", text: true },
    { header: "Source", key: "source" },
    { header: "Status", key: "status" },
    { header: "Created At", key: "createdAt" },
  ],
  contacts: [
    { header: "ID", key: "id" },
    { header: "Name", key: "name" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone", text: true },
    { header: "Position", key: "position" },
    { header: "Account", key: "accountName" },
    { header: "Created At", key: "createdAt" },
  ],
  accounts: [
    { header: "ID", key: "id" },
    { header: "Name", key: "name" },
    { header: "Industry", key: "industry" },
    { header: "Website", key: "website" },
    { header: "Created At", key: "createdAt" },
  ],
};

function isExportEntity(value: string): value is ExportEntity {
  return EXPORT_ENTITIES.includes(value as ExportEntity);
}

function getPaging(req: Request) {
  const startPage = Math.max(
    1,
    Number.parseInt(String(req.query.startPage || "1"), 10) || 1
  );
  const endPage = Math.max(
    startPage,
    Number.parseInt(String(req.query.endPage || startPage), 10) || startPage
  );
  const requestedLimit =
    Number.parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) ||
    DEFAULT_LIMIT;

  return {
    startPage,
    endPage,
    limit: Math.min(Math.max(1, requestedLimit), MAX_LIMIT),
  };
}

export class ExportController {
  private readonly excel = new ExcelService();

  private async fetchEntityData(
    entity: ExportEntity,
    startPage: number,
    endPage: number,
    limit: number
  ): Promise<ExportRow[]> {
    const skip = (startPage - 1) * limit;
    const take = (endPage - startPage + 1) * limit;

    if (entity === "leads") {
      const items = await prisma.lead.findMany({
        skip,
        take,
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return items.map(item => ({
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName ?? "",
        fullName: buildFullName(item.firstName, item.lastName),
        email: item.email,
        phone: item.phone || "",
        companyName: item.companyName || "",
        city: item.city || "",
        state: item.state || "",
        pincode: item.pincode || "",
        source: item.source || "",
        status: item.status || "",
        createdAt: item.createdAt.toISOString(),
      }));
    }

    if (entity === "contacts") {
      const items = await prisma.contact.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { account: true },
      });
      return items.map(item => ({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone || "",
        position: item.position || "",
        accountName: item.account?.name || "",
        createdAt: item.createdAt.toISOString(),
      }));
    }

    const items = await prisma.account.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
    return items.map(item => ({
      id: item.id,
      name: item.name,
      industry: item.industry || "",
      website: item.website || "",
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async exportEntityXlsx(req: Request, res: Response) {
    try {
      const format = String(req.query.format || "xlsx").toLowerCase();
      if (format !== "xlsx" && format !== "csv") {
        return handleValidationError(
          res,
          "Invalid format. Use xlsx or csv",
          "format",
          "Export entity"
        );
      }
      if (format === "csv") return this.exportEntityCsv(req, res);

      const entityValue = String(req.params.entity || "leads");
      if (!isExportEntity(entityValue)) {
        return handleValidationError(
          res,
          "Invalid entity. Use leads|contacts|accounts",
          "entity",
          "Export entity xlsx"
        );
      }

      const { startPage, endPage, limit } = getPaging(req);
      if (endPage - startPage + 1 > MAX_PAGE_COUNT) {
        return handleValidationError(
          res,
          `Page range too large. The maximum is ${MAX_PAGE_COUNT} pages.`,
          "endPage",
          "Export entity xlsx"
        );
      }

      const columns = EXPORT_COLUMNS[entityValue];
      const data = await this.fetchEntityData(
        entityValue,
        startPage,
        endPage,
        limit
      );
      const workbook = this.excel.createWorkbook();
      const sheet = workbook.addWorksheet(entityValue);
      sheet.columns = columns.map(({ header, key }) => ({ header, key }));
      data.forEach(item => sheet.addRow(item));
      columns.forEach((column, index) => {
        if (column.text) sheet.getColumn(index + 1).numFmt = "@";
      });
      this.excel.autosizeColumns(sheet);
      this.excel.styleDataWorksheet(sheet);

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ralli-wolf-${entityValue}-${stamp}.xlsx"`
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      handleError(error, res, "Export entity xlsx");
    }
  }

  async exportEntityCsv(req: Request, res: Response) {
    try {
      const entityValue = String(req.params.entity || "leads");
      if (!isExportEntity(entityValue)) {
        return handleValidationError(
          res,
          "Invalid entity. Use leads|contacts|accounts",
          "entity",
          "Export entity csv"
        );
      }

      const { startPage, endPage, limit } = getPaging(req);
      if (endPage - startPage + 1 > MAX_PAGE_COUNT) {
        return handleValidationError(
          res,
          `Page range too large. The maximum is ${MAX_PAGE_COUNT} pages.`,
          "endPage",
          "Export entity csv"
        );
      }

      const columns = EXPORT_COLUMNS[entityValue];
      const data = await this.fetchEntityData(
        entityValue,
        startPage,
        endPage,
        limit
      );
      const rows = data.map(item =>
        columns.map(column => item[column.key] ?? "")
      );
      const csvContent = stringify(
        [columns.map(column => column.header), ...rows],
        { header: false, quoted: true, quoted_empty: true, bom: true }
      );

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ralli-wolf-${entityValue}-${stamp}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      handleError(error, res, "Export entity csv");
    }
  }

  async emailSelectedLeadsXlsx(req: Request, res: Response) {
    try {
      const { to, leadIds } = req.body as { to?: string; leadIds?: number[] };
      if (!to) {
        return handleValidationError(
          res,
          "Recipient email is required",
          "to",
          "Email selected leads"
        );
      }
      const validLeadIds = Array.isArray(leadIds)
        ? [...new Set(leadIds.filter(id => Number.isInteger(id) && id > 0))]
        : [];
      if (!validLeadIds.length || validLeadIds.length > 1000) {
        return handleValidationError(
          res,
          "leadIds must contain between 1 and 1000 positive integers",
          "leadIds",
          "Email selected leads"
        );
      }
      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        return handleValidationError(
          res,
          "Email service not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL in the API environment.",
          "email",
          "Email selected leads"
        );
      }

      const items = await prisma.lead.findMany({
        where: { id: { in: validLeadIds }, deletedAt: null },
      });
      if (!items.length) {
        return handleValidationError(
          res,
          "No leads found for provided IDs",
          "leadIds",
          "Email selected leads"
        );
      }

      const workbook = this.excel.createWorkbook();
      const sheet = workbook.addWorksheet("Leads");
      sheet.columns = [
        { header: "Lead ID", key: "leadId" },
        { header: "Name", key: "name" },
        { header: "Email", key: "email" },
        { header: "Phone", key: "phone" },
        { header: "Source", key: "source" },
        { header: "Status", key: "status" },
        { header: "Created At", key: "createdAt" },
      ];
      items.forEach(item => {
        sheet.addRow({
          leadId: item.id,
          name: buildFullName(item.firstName, item.lastName),
          email: item.email,
          phone: item.phone || "",
          source: item.source || "",
          status: item.status || "",
          createdAt: item.createdAt.toISOString(),
        });
      });
      sheet.getColumn(4).numFmt = "@";
      this.excel.autosizeColumns(sheet);
      this.excel.styleDataWorksheet(sheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      const { emailService } = await import("../services/email.service.js");
      const filename = `ralli-wolf-leads-${stamp}.xlsx`;
      const ok = await emailService.sendEmail({
        to,
        subject: `Leads Export (${items.length})`,
        // `body` is the HTML part. This used to be a bare sentence, which
        // arrived as one unstyled line with none of the shell every other
        // message in the app carries.
        body: renderEmail({
          preview: `${items.length} leads attached as Excel.`,
          eyebrow: "Data export",
          heading: "Your leads export is attached",
          paragraphs: [
            `The ${items.length} lead${items.length === 1 ? "" : "s"} you selected are attached to this message as an Excel workbook.`,
          ],
          rowsLabel: "Export details",
          rows: [
            { label: "Records", value: String(items.length) },
            { label: "File", value: filename },
            { label: "Format", value: "Excel (.xlsx)" },
          ],
          footer:
            "You receive this message when you export leads from the CRM.",
        }),
        attachments: {
          [filename]: {
            content: Buffer.from(buffer).toString("base64"),
            mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        },
      });

      if (!ok) {
        return handleValidationError(
          res,
          "Failed to send email. Verify the configured email credentials and sender settings.",
          "email",
          "Email selected leads"
        );
      }
      return res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Email selected leads");
    }
  }
}
