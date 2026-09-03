import { Request, Response } from "express";
import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";

import {
  handleError,
  handleForbiddenError,
  handleValidationError,
} from "../utils/error-handler.js";
import { ExcelService } from "../services/excel.service.js";
import {
  entityCatalogue,
  findEntity,
  type TransferEntity,
} from "../services/dataTransfer/registry.js";
import {
  canTransfer,
  type TransferOperation,
} from "../services/dataTransfer/authorization.js";
import { parsePageRange } from "../utils/validators.js";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;
const MAX_PAGE_COUNT = 200;

const MAX_IMPORT_ROWS = 5000;

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string")
      return value.text.trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText
        .map(run => run.text ?? "")
        .join("")
        .trim();
  }
  return String(value).trim();
}

export class DataTransferController {
  private readonly excel = new ExcelService();

  async catalogue(req: Request, res: Response) {
    try {
      const data = entityCatalogue().flatMap(item => {
        const entity = findEntity(item.key);
        if (!entity || !req.user) return [];

        const exportable = this.allowed(req, entity, "export");
        const importable =
          Boolean(entity.importable) && this.allowed(req, entity, "import");
        if (!exportable && !importable) return [];

        return [
          {
            ...item,
            exportable,
            importable,
            requiredColumns: importable ? item.requiredColumns : [],
          },
        ];
      });
      res.json({ data });
    } catch (error) {
      handleError(error, res, "Data transfer catalogue");
    }
  }

  private resolve(req: Request, res: Response): TransferEntity | null {
    const key = String(req.params.entity ?? "");
    const entity = findEntity(key);
    if (!entity) {
      handleValidationError(
        res,
        `Unknown dataset "${key}".`,
        "entity",
        "Data transfer"
      );
      return null;
    }
    return entity;
  }

  private allowed(
    req: Request,
    entity: TransferEntity,
    operation: TransferOperation
  ): boolean {
    return Boolean(
      req.user &&
        canTransfer(req.user.role, req.user.permissions, entity.key, operation)
    );
  }

  private authorize(
    req: Request,
    res: Response,
    entity: TransferEntity,
    operation: TransferOperation
  ): boolean {
    if (this.allowed(req, entity, operation)) return true;
    handleForbiddenError(
      res,
      `You do not have permission to ${operation} ${entity.label}.`,
      "Data transfer"
    );
    return false;
  }

  async exportEntity(req: Request, res: Response) {
    try {
      const format = String(req.query.format ?? "xlsx").toLowerCase();
      if (format !== "xlsx" && format !== "csv") {
        return handleValidationError(
          res,
          "Invalid format. Use xlsx or csv.",
          "format",
          "Export"
        );
      }

      const entity = this.resolve(req, res);
      if (!entity) return;
      if (!this.authorize(req, res, entity, "export")) return;

      const pageRange = parsePageRange(
        req.query.startPage,
        req.query.endPage,
        req.query.limit,
        DEFAULT_LIMIT,
        MAX_LIMIT
      );
      if (!pageRange) {
        return handleValidationError(
          res,
          `Pages must be ordered positive integers and limit must be between 1 and ${MAX_LIMIT}.`,
          undefined,
          "Export"
        );
      }
      const { startPage, endPage, limit } = pageRange;
      if (endPage - startPage + 1 > MAX_PAGE_COUNT) {
        return handleValidationError(
          res,
          `Page range too large. The maximum is ${MAX_PAGE_COUNT} pages.`,
          "endPage",
          "Export"
        );
      }

      const rows = await entity.fetch(
        (startPage - 1) * limit,
        (endPage - startPage + 1) * limit
      );
      const filename = `ralli-wolf-${entity.key}-${stamp()}`;

      if (format === "csv") {
        const csv = stringify(rows, {
          header: true,
          columns: entity.columns.map(c => ({ key: c.key, header: c.header })),
        });
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.csv"`
        );

        return res.send(`\uFEFF${csv}`);
      }

      const workbook = this.excel.createWorkbook();
      const sheet = workbook.addWorksheet(entity.label.slice(0, 31));
      sheet.columns = entity.columns.map(({ header, key }) => ({
        header,
        key,
      }));
      rows.forEach(row => sheet.addRow(row));
      entity.columns.forEach((column, index) => {
        if (column.text) sheet.getColumn(index + 1).numFmt = "@";
      });
      this.excel.autosizeColumns(sheet);
      this.excel.styleDataWorksheet(sheet);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.xlsx"`
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      handleError(error, res, "Export");
    }
  }

  async template(req: Request, res: Response) {
    try {
      const entity = this.resolve(req, res);
      if (!entity) return;
      if (!this.authorize(req, res, entity, "import")) return;
      if (!entity.importable) {
        return handleValidationError(
          res,
          `${entity.label} cannot be imported, so it has no template.`,
          "entity",
          "Import template"
        );
      }

      const workbook = this.excel.createWorkbook();
      const sheet = workbook.addWorksheet(entity.label.slice(0, 31));

      const importable = entity.columns.filter(
        c => c.key !== "id" && !c.key.endsWith("At")
      );
      sheet.columns = importable.map(({ header, key }) => ({ header, key }));
      this.excel.autosizeColumns(sheet);
      this.excel.styleDataWorksheet(sheet);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ralli-wolf-${entity.key}-template.xlsx"`
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      handleError(error, res, "Import template");
    }
  }

  async importEntity(req: Request, res: Response) {
    try {
      const entity = this.resolve(req, res);
      if (!entity) return;
      if (!this.authorize(req, res, entity, "import")) return;

      const rule = entity.importable;
      if (!rule) {
        return handleValidationError(
          res,
          `${entity.label} cannot be imported. It is derived from other records, and creating it from a spreadsheet would bypass the rules that keep it correct.`,
          "entity",
          "Import"
        );
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return handleValidationError(
          res,
          "No file was uploaded.",
          "file",
          "Import"
        );
      }

      let raw: Array<Record<string, string>>;
      if (/\.csv$/i.test(file.originalname ?? "")) {
        raw = parseCsv(file.buffer.toString("utf8").replace(/^\uFEFF/, ""), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, string>>;
      } else {
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(
          file.buffer as unknown as Parameters<typeof book.xlsx.load>[0]
        );
        const sheet = book.worksheets[0];
        if (!sheet) {
          return handleValidationError(
            res,
            "That workbook has no sheets.",
            "file",
            "Import"
          );
        }
        const headers: string[] = [];
        sheet.getRow(1).eachCell((cell, column) => {
          headers[column - 1] = cellText(cell.value);
        });
        raw = [];
        sheet.eachRow((row, index) => {
          if (index === 1) return;
          const record: Record<string, string> = {};
          let any = false;
          row.eachCell({ includeEmpty: true }, (cell, column) => {
            const header = headers[column - 1];
            if (!header) return;
            const value = cellText(cell.value);
            if (value) any = true;
            record[header] = value;
          });

          if (any) raw.push(record);
        });
      }

      if (raw.length === 0) {
        return handleValidationError(
          res,
          "That file has no rows.",
          "file",
          "Import"
        );
      }
      if (raw.length > MAX_IMPORT_ROWS) {
        return handleValidationError(
          res,
          `That file has ${raw.length} rows; the limit is ${MAX_IMPORT_ROWS}.`,
          "file",
          "Import"
        );
      }

      const byHeader = new Map(
        entity.columns.map(c => [c.header.toLowerCase(), c.key])
      );
      const byKey = new Map(
        entity.columns.map(c => [c.key.toLowerCase(), c.key])
      );
      const normalise = (row: Record<string, string>) => {
        const out: Record<string, string> = {};
        for (const [header, value] of Object.entries(row)) {
          const key =
            byHeader.get(header.trim().toLowerCase()) ??
            byKey.get(header.trim().toLowerCase());
          if (key) out[key] = String(value ?? "").trim();
        }
        return out;
      };

      let created = 0;
      let updated = 0;
      const errors: Array<{ row: number; reason: string }> = [];
      const seen = new Set<string>();

      for (let i = 0; i < raw.length; i++) {
        const line = i + 2;
        const row = normalise(raw[i]!);

        const missing = rule.required.filter(field => !row[field]);
        if (missing.length > 0) {
          errors.push({
            row: line,
            reason: `Missing ${missing.join(", ")}.`,
          });
          continue;
        }

        const identity = row[rule.uniqueBy]?.toLowerCase();
        if (identity && seen.has(identity)) {
          errors.push({
            row: line,
            reason: `Duplicate ${rule.uniqueBy} "${row[rule.uniqueBy]}" earlier in this file.`,
          });
          continue;
        }
        if (identity) seen.add(identity);

        try {
          const outcome = await rule.apply(row);
          if (outcome === "created") created++;
          else updated++;
        } catch (error) {
          errors.push({
            row: line,
            reason:
              error instanceof Error ? error.message : "Could not be saved.",
          });
        }
      }

      res.json({
        data: {
          entity: entity.key,
          label: entity.label,
          totalRows: raw.length,
          created,
          updated,
          failed: errors.length,
          errors: errors.slice(0, 100),
        },
      });
    } catch (error) {
      handleError(error, res, "Import");
    }
  }
}
