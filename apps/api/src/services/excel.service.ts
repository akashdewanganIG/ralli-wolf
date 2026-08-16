import ExcelJS from "exceljs";

export type ExportEntity = "leads" | "contacts" | "accounts";

export class ExcelService {
  createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ralli Wolf CRM";
    workbook.company = "Ralli Wolf";
    workbook.created = new Date();
    return workbook;
  }

  styleDataWorksheet(worksheet: ExcelJS.Worksheet) {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    const lastColumn = worksheet.columnCount;
    if (lastColumn > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: lastColumn },
      };
    }

    const header = worksheet.getRow(1);
    header.height = 28;
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFED1C24" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FFB51219" } },
      };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 22;
      if (rowNumber % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        });
      }
      row.eachCell(cell => {
        cell.alignment = { vertical: "middle" };
      });
    });
  }

  autosizeColumns(worksheet: ExcelJS.Worksheet) {
    worksheet.columns?.forEach(column => {
      let maxLength = 10;
      column?.eachCell?.({ includeEmpty: true }, cell => {
        const cellValue = cell.value as
          | string
          | number
          | Date
          | null
          | undefined;
        const cellText = cellValue == null ? "" : String(cellValue);
        maxLength = Math.max(maxLength, cellText.length + 2);
      });
      if (column) {
        column.width = Math.min(42, Math.max(12, maxLength));
      }
    });
  }
}
