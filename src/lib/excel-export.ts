import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  // "currency" right-aligns and gets a bordered numeric style; everything
  // else left-aligns as plain text.
  type?: "text" | "number" | "currency";
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, string | number | null>>;
  // Optional footer row (e.g. totals) — same keys as `columns`.
  totals?: Record<string, string | number | null>;
}

const HEADER_FILL = "FF1F6F5C"; // dark teal, matches the app's --teal accent
const TITLE_FILL = "FFEFF7F5"; // pale teal tint
const ZEBRA_FILL = "FFF5F7F6";
const BORDER_COLOR = "FFD8E0DE";

const thinBorder = {
  top: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  left: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  bottom: { style: "thin" as const, color: { argb: BORDER_COLOR } },
  right: { style: "thin" as const, color: { argb: BORDER_COLOR } },
};

// Builds a single-sheet workbook with a merged title band, a colored header
// row, zebra-striped data rows, and an optional bold totals row — then
// triggers a browser download. Used by both the Teacher Salary and Student
// Fees "Export Excel" buttons so they stay visually consistent.
export async function exportStyledExcel(options: ExcelExportOptions): Promise<void> {
  const { filename, sheetName, title, subtitle, columns, rows, totals } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "APHS School Management";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: subtitle ? 4 : 3 }],
  });

  const colCount = columns.length;

  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));

  // Title band
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 15, color: { argb: "FF1F6F5C" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
  sheet.getRow(1).height = 26;

  let nextRowIndex = 2;
  if (subtitle) {
    sheet.mergeCells(2, 1, 2, colCount);
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, size: 10.5, color: { argb: "FF5B6B67" } };
    subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
    nextRowIndex = 3;
  }

  // Blank spacer row
  nextRowIndex += 1;

  // Header row
  const headerRow = sheet.getRow(nextRowIndex);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = {
      vertical: "middle",
      horizontal: c.type === "number" || c.type === "currency" ? "right" : "left",
    };
    cell.border = thinBorder;
  });
  headerRow.height = 22;
  nextRowIndex += 1;

  // Data rows
  rows.forEach((row, rowIdx) => {
    const excelRow = sheet.getRow(nextRowIndex + rowIdx);
    columns.forEach((c, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      const value = row[c.key];
      cell.value = c.type === "currency" && typeof value === "number" ? value : (value ?? "");
      if (c.type === "currency") {
        cell.numFmt = '"৳"#,##0';
      }
      cell.alignment = {
        vertical: "middle",
        horizontal: c.type === "number" || c.type === "currency" ? "right" : "left",
      };
      cell.border = thinBorder;
      if (rowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
      }
    });
  });
  nextRowIndex += rows.length;

  // Totals row
  if (totals) {
    const totalsRow = sheet.getRow(nextRowIndex);
    columns.forEach((c, colIdx) => {
      const cell = totalsRow.getCell(colIdx + 1);
      const value = totals[c.key];
      cell.value = c.type === "currency" && typeof value === "number" ? value : (value ?? "");
      if (c.type === "currency") {
        cell.numFmt = '"৳"#,##0';
      }
      cell.font = { bold: true };
      cell.alignment = {
        vertical: "middle",
        horizontal: c.type === "number" || c.type === "currency" ? "right" : "left",
      };
      cell.border = {
        top: { style: "double", color: { argb: HEADER_FILL } },
        left: { style: "thin", color: { argb: BORDER_COLOR } },
        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
        right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
