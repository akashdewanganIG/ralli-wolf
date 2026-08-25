import { Request, Response } from "express";
import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";

import { handleError, handleValidationError } from "../utils/errorHandler.js";
import { ExcelService } from "../services/excel.service.js";
import {
  entityCatalogue,
  findEntity,
  type TransferEntity,
} from "../services/dataTransfer/registry.js";

/**
 * One export and one import endpoint for every dataset in the registry.
 *
 * There is deliberately no per-entity code here. Everything that differs
 * between leads and work centres lives in the registry; this file only knows
 * how to page, how to write a workbook, and how to read one back.
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;
const MAX_PAGE_COUNT = 200;
/** A spreadsheet bigger than this is a data-migration job, not an import. */
const MAX_IMPORT_ROWS = 5000;

function paging(req: Request) {
  const startPage = Math.max(
    1,
    Number.parseInt(String(req.query.startPage ?? "1"), 10) || 1
  );
  const endPage = Math.max(
    startPage,
    Number.parseInt(String(req.query.endPage ?? startPage), 10) || startPage
  );
  const requested =
    Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) ||
    DEFAULT_LIMIT;
  return {
    startPage,
    endPage,
    limit: Math.min(Math.max(1, requested), MAX_LIMIT),
  };
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One cell as plain text.
 *
 * ExcelJS returns dates, formula results, hyperlinks and rich text as objects
 * rather than strings, and a spreadsheet in the wild contains all of them.
 */
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

  /** Everything the UI needs to build its picker. */
  async catalogue(_req: Request, res: Response) {
    try {
      res.json({ data: entityCatalogue() });
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

  /** GET /api/data/:entity/export?format=xlsx|csv */
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

      const { startPage, endPage, limit } = paging(req);
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
        // The byte-order mark is what makes Excel open a UTF-8 CSV without
        // mangling accented names and currency symbols. Written as an escape
        // rather than the character itself, which is invisible in a diff.
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

  /**
   * GET /api/data/:entity/template
   *
   * The import template is the export's column set with no rows, so the file
   * a user fills in is by construction the file the importer expects.
   */
  async template(req: Request, res: Response) {
    try {
      const entity = this.resolve(req, res);
      if (!entity) return;
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
      // Only the columns the importer reads. Exporting every display column
      // would invite people to fill in derived values that are ignored.
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

  /**
   * POST /api/data/:entity/import — multipart, field name `file`.
   *
   * Every row is reported on. A row that fails is skipped with its line
   * number and a plain reason rather than aborting the file, because a single
   * bad cell in a thousand-row sheet should not cost the other 999.
   */
  async importEntity(req: Request, res: Response) {
    try {
      const entity = this.resolve(req, res);
      if (!entity) return;

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

      // CSV and XLSX both reduce to "an array of header-keyed rows"; the two
      // readers differ only in how they get there.
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
          // A row of nothing is Excel padding, not a record someone meant.
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

      // Accept either the human header ("First Name") or the field key
      // ("firstName"), so a file exported from here can be re-imported.
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
        // +2: one for the header row, one because humans count from 1.
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
