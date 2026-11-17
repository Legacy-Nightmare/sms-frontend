import { jsPDF } from "jspdf";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import type { ProgressReportDto } from "@/lib/exams-api";

// Bangladesh NCTB scale — must match backend/src/exams/grading.ts exactly;
// this is the printed reference legend, not a second source of truth.
const GRADE_SCALE: Array<[string, string, string]> = [
  ["80-100", "A+", "5.00"],
  ["70-79", "A", "4.00"],
  ["60-69", "A-", "3.50"],
  ["50-59", "B", "3.00"],
  ["40-49", "C", "2.00"],
  ["33-39", "D", "1.00"],
  ["0-32", "F", "0.00"],
];

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function remarkForGpa(gpa: number): string {
  if (gpa >= 4.5) return "Excellent";
  if (gpa >= 3.5) return "Very Good";
  if (gpa >= 3.0) return "Good";
  if (gpa >= 2.0) return "Average";
  return "Needs Improvement";
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Draws one row of a plain grid table: vertical dividers between columns, a
// horizontal line under the row, and left-aligned text in each cell. No
// autotable dependency — this project only ships plain jspdf.
function drawRow(
  doc: jsPDF,
  x: number,
  y: number,
  rowHeight: number,
  colWidths: number[],
  cells: string[],
  opts: { bold?: boolean; fontSize?: number } = {},
) {
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.fontSize ?? 8.5);
  let cx = x;
  cells.forEach((text, i) => {
    const width = colWidths[i] ?? 0;
    const lines = doc.splitTextToSize(text, width - 2);
    doc.text(lines, cx + 1.5, y + rowHeight / 2 + 1, { baseline: "middle" });
    cx += width;
  });
}

function drawGridLines(
  doc: jsPDF,
  x: number,
  yTop: number,
  rowHeight: number,
  rowCount: number,
  colWidths: number[],
) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableHeight = rowHeight * rowCount;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.15);
  let cx = x;
  for (let i = 0; i <= colWidths.length; i++) {
    doc.line(cx, yTop, cx, yTop + tableHeight);
    cx += colWidths[i] ?? 0;
  }
  for (let i = 0; i <= rowCount; i++) {
    doc.line(x, yTop + i * rowHeight, x + tableWidth, yTop + i * rowHeight);
  }
}

export async function downloadProgressReportPdf(
  report: ProgressReportDto,
  address: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 15;
  const right = 195;
  const width = right - left;
  let y = 15;

  // Header: logo top-left, school name/address/exam title wrapped beside it
  // — same overlap-proof pattern as the admit card (long text wraps inside
  // its own column instead of running into the logo or off the page).
  const logoSize = 20;
  const logoDataUrl = await loadImageAsDataUrl(SCHOOL_LOGO);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "JPEG", left, y, logoSize, logoSize);
    } catch {
      // Unsupported format — header text still renders without it.
    }
  }
  const textLeft = left + logoSize + 6;
  const textWidth = right - textLeft;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(SCHOOL_NAME, textLeft, y + 6, { maxWidth: textWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let headerY = y + 12;
  if (address) {
    doc.text(address, textLeft, headerY, { maxWidth: textWidth });
    headerY += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.text(report.examTitle, textLeft, headerY, { maxWidth: textWidth });

  y += logoSize + 6;

  // Boxed "Progress Report" title, centered.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titleWidth = doc.getTextWidth("Progress Report") + 16;
  const titleX = (left + right) / 2 - titleWidth / 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(titleX, y, titleWidth, 9);
  doc.text("Progress Report", (left + right) / 2, y + 6.2, { align: "center" });
  y += 15;

  // Student info row.
  drawGridLines(doc, left, y, 8, 1, [36, 60, 24, 35, 24, width - 36 - 60 - 24 - 35 - 24]);
  drawRow(
    doc,
    left,
    y,
    8,
    [36, 60, 24, 35, 24, width - 36 - 60 - 24 - 35 - 24],
    ["Student's Name", report.studentName, "Class", report.className, "Roll No", String(report.roll)],
    { bold: true, fontSize: 9.5 },
  );
  // Values aren't bold — redraw just the value cells normal-weight on top.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(report.studentName, left + 36 + 1.5, y + 5);
  doc.text(report.className, left + 36 + 60 + 24 + 1.5, y + 5);
  doc.text(String(report.roll), left + 36 + 60 + 24 + 35 + 24 + 1.5, y + 5);
  y += 12;

  // Grading-scale legend, small, right-aligned.
  const legendColWidths = [18, 14, 14];
  const legendWidth = legendColWidths.reduce((a, b) => a + b, 0);
  const legendX = right - legendWidth;
  drawRow(doc, legendX, y, 5, legendColWidths, ["Mark", "Grade", "GPA"], { bold: true, fontSize: 7.5 });
  GRADE_SCALE.forEach((row, i) => {
    drawRow(doc, legendX, y + 5 * (i + 1), 5, legendColWidths, row, { fontSize: 7.5 });
  });
  drawGridLines(doc, legendX, y, 5, GRADE_SCALE.length + 1, legendColWidths);
  const legendBottom = y + 5 * (GRADE_SCALE.length + 1);

  // Main subject table.
  const subjectCols = [46, 14, 11, 11, 15, 16, 15, 13, 13, 12, 14];
  const headerRowHeight = 10;
  const dataRowHeight = 8;
  drawRow(
    doc,
    left,
    y,
    headerRowHeight,
    subjectCols,
    [
      "Subject Name",
      "Full\nMarks",
      "T1",
      "T2",
      "1st\nSemester",
      "Total\nMarks",
      "Highest\nMarks",
      "Grade\nPoint",
      "Letter\nGrade",
      "GPA",
      "Position",
    ],
    { bold: true, fontSize: 7.5 },
  );
  let rowY = y + headerRowHeight;
  report.subjects.forEach((s, i) => {
    drawRow(
      doc,
      left,
      rowY,
      dataRowHeight,
      subjectCols,
      [
        s.subjectName,
        String(s.fullMarks),
        s.ct1Marks != null ? String(s.ct1Marks) : "—",
        s.ct2Marks != null ? String(s.ct2Marks) : "—",
        s.semesterFinalMarks != null ? String(s.semesterFinalMarks) : "—",
        String(s.totalMarks),
        String(s.highestMarks),
        s.gradePoint.toFixed(2),
        s.letterGrade,
        i === 0 ? report.gpa.toFixed(2) : "",
        i === 0 ? ordinal(report.position) : "",
      ],
      { fontSize: 8 },
    );
    rowY += dataRowHeight;
  });
  // Total row.
  drawRow(
    doc,
    left,
    rowY,
    dataRowHeight,
    subjectCols,
    [
      "Total Marks",
      String(report.totalFullMarks),
      "",
      "",
      "",
      String(report.totalObtained),
      "",
      "",
      "",
      "",
      "",
    ],
    { bold: true, fontSize: 8 },
  );
  rowY += dataRowHeight;
  drawGridLines(doc, left, y, headerRowHeight, 1, subjectCols);
  drawGridLines(doc, left, y + headerRowHeight, dataRowHeight, report.subjects.length + 1, subjectCols);
  // Merge the GPA/Position columns visually (erase the inner horizontal
  // lines between subject rows in those two columns) so they read as one
  // spanning cell, same as the printed card.
  const gpaColX = left + subjectCols.slice(0, 9).reduce((a, b) => a + b, 0);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  for (let i = 1; i < report.subjects.length; i++) {
    doc.line(gpaColX + 0.1, y + headerRowHeight + i * dataRowHeight, right - 0.1, y + headerRowHeight + i * dataRowHeight);
  }

  y = Math.max(rowY, legendBottom) + 10;

  // Attendance / remarks footer.
  const footerCols = [45, 45, 45, width - 135];
  drawGridLines(doc, left, y, 8, 2, footerCols);
  drawRow(doc, left, y, 8, footerCols, [
    "Total Working Days",
    report.totalWorkingDays != null ? String(report.totalWorkingDays) : "—",
    "Total Attendances",
    report.totalAttendances != null ? String(report.totalAttendances) : "—",
  ], { bold: true, fontSize: 9 });
  doc.setFont("helvetica", "normal");
  doc.text(
    report.totalWorkingDays != null ? String(report.totalWorkingDays) : "—",
    left + footerCols[0]! + 1.5,
    y + 5,
  );
  doc.text(
    report.totalAttendances != null ? String(report.totalAttendances) : "—",
    left + footerCols[0]! + footerCols[1]! + footerCols[2]! + 1.5,
    y + 5,
  );
  drawRow(doc, left, y + 8, 8, [width], ["Remarks"], { bold: true, fontSize: 9 });
  doc.setFont("helvetica", "normal");
  doc.text(remarkForGpa(report.gpa), left + 36, y + 13);
  y += 26;

  // Signature lines.
  const sigWidth = (width - 20) / 3;
  const sigY = y + 25;
  [
    ["Class Teacher's Signature", left],
    ["Guardian's Signature", left + sigWidth + 10],
    ["Principal's Signature", left + 2 * (sigWidth + 10)],
  ].forEach(([label, x]) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(x as number, sigY, (x as number) + sigWidth, sigY);
    doc.setFontSize(8.5);
    doc.text(label as string, x as number, sigY + 5);
  });
  doc.setFontSize(9);
  doc.text(
    `G.P.A: ${report.gpa.toFixed(2)}`,
    left + 2 * (sigWidth + 10),
    sigY + 11,
  );

  const filename = `progress-report-${report.studentCode}-${report.academicYear}.pdf`.replace(/\s+/g, "-");
  doc.save(filename);
}
