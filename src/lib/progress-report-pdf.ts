import { jsPDF } from "jspdf";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import type { ProgressReportDto } from "@/lib/exams-api";

// Bangladesh NCTB scale — must match backend/src/exams/grading.ts exactly;
// this is the printed reference legend, not a second source of truth.
const GRADE_SCALE: Array<[string, string, string]> = [
  ["80-100", "A+", "5.0"],
  ["70-79", "A", "4.0"],
  ["60-69", "A-", "3.5"],
  ["50-59", "B", "3.0"],
  ["40-49", "C", "2.0"],
  ["33-39", "D", "1.0"],
  ["0-32", "F", "0.0"],
];

// RGB, matching the on-screen pill colors for each letter grade.
const GRADE_COLORS: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
  "A+": { bg: [214, 241, 227], text: [20, 108, 73] },
  A: { bg: [213, 236, 239], text: [17, 94, 104] },
  "A-": { bg: [232, 220, 241], text: [105, 56, 136] },
  B: { bg: [250, 232, 196], text: [150, 100, 10] },
  C: { bg: [250, 232, 196], text: [150, 100, 10] },
  D: { bg: [248, 214, 210], text: [163, 45, 35] },
  F: { bg: [248, 214, 210], text: [163, 45, 35] },
};
const GREEN: [number, number, number] = [16, 66, 50];
const ORANGE: [number, number, number] = [196, 120, 28];
const GREEN_TINT: [number, number, number] = [224, 242, 234];
const MUTED: [number, number, number] = [110, 118, 128];

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
  if (gpa >= 4.5) return "Excellent (Outstanding)";
  if (gpa >= 3.5) return "Very Good";
  if (gpa >= 3.0) return "Good";
  if (gpa >= 2.0) return "Average";
  return "Needs Improvement";
}

function resultStatus(letterGrade: string, gpa: number): string {
  if (letterGrade === "F") return "Failed";
  if (gpa >= 4.5) return "Passed with Honors";
  if (gpa >= 3.5) return "Passed with Distinction";
  return "Passed";
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

// One grid row: a vertical divider before each cell, text inside, no
// per-cell re-draws — every cell is written exactly once, at one x/y, so
// cells never ghost on top of each other.
function drawRow(
  doc: jsPDF,
  x: number,
  y: number,
  rowHeight: number,
  colWidths: number[],
  cells: string[],
  opts: { bold?: boolean; fontSize?: number; color?: [number, number, number] } = {},
) {
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.fontSize ?? 8.5);
  doc.setTextColor(...(opts.color ?? [20, 20, 20]));
  let cx = x;
  cells.forEach((text, i) => {
    const width = colWidths[i] ?? 0;
    const lines = doc.splitTextToSize(text, width - 3);
    doc.text(lines, cx + 1.5, y + rowHeight / 2 + 1, { baseline: "middle" });
    cx += width;
  });
  doc.setTextColor(0, 0, 0);
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
  doc.setDrawColor(200, 200, 200);
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

function labelValue(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  color: [number, number, number] = [20, 20, 20],
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(value, x, y + 5.5);
  doc.setTextColor(0, 0, 0);
}

// Landscape, not portrait — the on-screen card layout (header + 3 summary
// boxes + a 9-column table) needs real width to avoid the cramped, text-
// overlapping mess a portrait page forces it into.
export async function downloadProgressReportPdf(
  report: ProgressReportDto,
  address: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const left = 15;
  const right = 282;
  const width = right - left;
  let y = 15;

  // Header: logo top-left, school name/address/exam title wrapped beside
  // it, a class/roll chip on the far right.
  const logoSize = 20;
  const logoDataUrl = await loadImageAsDataUrl(SCHOOL_LOGO);

  // Full-color logo watermark, centered over where the subject table sits
  // (not the whole page — the header and colored stat boxes above it are
  // solid-filled, so a watermark there would just be hidden) — drawn
  // first, low opacity via jsPDF's graphics state (not grayscale), same
  // approach as the admit card.
  if (logoDataUrl) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const wmSize = 95;
    try {
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.08 }));
      doc.addImage(logoDataUrl, "JPEG", (pageWidth - wmSize) / 2, 98, wmSize, wmSize);
      doc.restoreGraphicsState();
    } catch {
      // Unsupported format — rest of the page still renders without it.
    }
  }

  const chipLabel = `Class: ${report.className} - Roll: ${report.roll}`;
  const chipWidth = doc.getTextWidth(chipLabel) + 10;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "JPEG", left, y, logoSize, logoSize);
    } catch {
      // Unsupported format — header text still renders without it.
    }
  }
  const textLeft = left + logoSize + 6;
  const textWidth = right - chipWidth - 6 - textLeft;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(SCHOOL_NAME, textLeft, y + 6, { maxWidth: textWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const subtitle = [address, report.examTitle].filter(Boolean).join("  •  ");
  doc.text(subtitle, textLeft, y + 12, { maxWidth: textWidth });
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(right - chipWidth, y + 1, chipWidth, 7, 3, 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(chipLabel, right - chipWidth / 2, y + 5.3, { align: "center" });

  y += logoSize + 6;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 8;

  // Three summary boxes: student info (wide) + GPA (green) + position
  // (orange) — matching the on-screen card layout.
  const boxHeight = 38;
  const gap = 6;
  const gpaBoxWidth = 55;
  const posBoxWidth = 55;
  const infoBoxWidth = width - gpaBoxWidth - posBoxWidth - 2 * gap;
  const passed = report.letterGrade !== "F";

  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(left, y, infoBoxWidth, boxHeight, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("STUDENT INFORMATION", left + 5, y + 7);
  doc.setTextColor(0, 0, 0);
  const col1 = left + 5;
  const col2 = left + infoBoxWidth / 3 + 3;
  const col3 = left + (2 * infoBoxWidth) / 3 + 1;
  labelValue(doc, col1, y + 16, "Student Name", report.studentName);
  labelValue(doc, col2, y + 16, "Class & Roll", `${report.className} (Roll ${String(report.roll).padStart(2, "0")})`);
  labelValue(doc, col3, y + 16, "Academic Term", report.examTitle);
  const attendancePct =
    report.totalWorkingDays && report.totalWorkingDays > 0
      ? Math.round(((report.totalAttendances ?? 0) / report.totalWorkingDays) * 100)
      : null;
  labelValue(
    doc,
    col1,
    y + 29,
    "Working Days / Present",
    `${report.totalWorkingDays ?? "—"} / ${report.totalAttendances ?? "—"} Days${attendancePct !== null ? ` (${attendancePct}%)` : ""}`,
  );
  labelValue(doc, col2, y + 29, "Result Status", resultStatus(report.letterGrade, report.gpa), passed ? [20, 120, 85] : [180, 50, 40]);
  labelValue(doc, col3, y + 29, "Teacher's Remarks", remarkForGpa(report.gpa), [20, 120, 85]);

  const gpaBoxX = left + infoBoxWidth + gap;
  doc.setFillColor(...GREEN);
  doc.roundedRect(gpaBoxX, y, gpaBoxWidth, boxHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(230, 240, 235);
  doc.text("GRADE POINT", gpaBoxX + 5, y + 8);
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(report.gpa.toFixed(2), gpaBoxX + 5, y + 22);
  const gpaValueWidth = doc.getTextWidth(report.gpa.toFixed(2));
  doc.setFontSize(9);
  doc.text("/5.00", gpaBoxX + 5 + gpaValueWidth + 2, y + 22);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${passed ? "Passed" : "Failed"} • Letter Grade: ${report.letterGrade}`, gpaBoxX + 5, y + 31);

  const posBoxX = gpaBoxX + gpaBoxWidth + gap;
  doc.setFillColor(...ORANGE);
  doc.roundedRect(posBoxX, y, posBoxWidth, boxHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(250, 236, 216);
  doc.text("MERIT POSITION", posBoxX + 5, y + 8);
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(ordinal(report.position), posBoxX + 5, y + 22);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    report.position === 1 ? `Top of ${report.className}` : `Out of ${report.totalStudents} in ${report.className}`,
    posBoxX + 5,
    y + 31,
  );
  doc.setTextColor(0, 0, 0);

  y += boxHeight + 9;

  // Subject breakdown label + grading-scale legend, both on one line —
  // there's room for this now that the page is landscape.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("SUBJECT BREAKDOWN & EVALUATION", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let legendX = right;
  const legendParts = [...GRADE_SCALE.map(([r, g, gpa]) => `${r}: ${g} (${gpa})`)].reverse();
  legendParts.forEach((part) => {
    legendX -= doc.getTextWidth(part) + 6;
  });
  let cx = legendX;
  legendParts.forEach((part) => {
    doc.text(part, cx, y);
    cx += doc.getTextWidth(part) + 6;
  });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Main subject table — Full/T1/T2/1st Semester/Total/Highest/Grade
  // Point/Letter Grade. GPA and Position live in the boxes above instead
  // of as table columns (they're once-per-student, not once-per-subject).
  const subjectCols = [60, 20, 18, 18, 22, 24, 22, 22, 26];
  const headerRowHeight = 9;
  const dataRowHeight = 9;
  drawRow(
    doc,
    left,
    y,
    headerRowHeight,
    subjectCols,
    ["Subject Name", "Full Marks", "T1", "T2", "1st Semester", "Total Marks", "Highest", "Grade Point", "Letter Grade"],
    { bold: true, fontSize: 8, color: MUTED },
  );
  let rowY = y + headerRowHeight;
  report.subjects.forEach((s) => {
    doc.setFillColor(...GREEN_TINT);
    doc.rect(left + subjectCols.slice(0, 5).reduce((a, b) => a + b, 0), rowY, subjectCols[5]!, dataRowHeight, "F");
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
        "",
      ],
      { fontSize: 9 },
    );
    // Highest Marks is secondary info — muted, like the on-screen pill.
    const highestX = left + subjectCols.slice(0, 6).reduce((a, b) => a + b, 0);
    doc.setFillColor(255, 255, 255);
    doc.rect(highestX + 0.2, rowY + 0.2, subjectCols[6]! - 0.4, dataRowHeight - 0.4, "F");
    drawRow(doc, highestX, rowY, dataRowHeight, [subjectCols[6]!], [String(s.highestMarks)], {
      fontSize: 9,
      color: MUTED,
    });
    // Letter-grade pill.
    const pillX = left + subjectCols.slice(0, 8).reduce((a, b) => a + b, 0) + 2;
    const pillColors = GRADE_COLORS[s.letterGrade] ?? { bg: [230, 230, 230] as const, text: [80, 80, 80] as const };
    doc.setFillColor(...pillColors.bg);
    doc.roundedRect(pillX, rowY + dataRowHeight / 2 - 3, 16, 6, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...pillColors.text);
    doc.text(s.letterGrade, pillX + 8, rowY + dataRowHeight / 2 + 1.3, { align: "center" });
    doc.setTextColor(0, 0, 0);
    rowY += dataRowHeight;
  });

  drawGridLines(doc, left, y, headerRowHeight, 1, subjectCols);
  drawGridLines(doc, left, y + headerRowHeight, dataRowHeight, report.subjects.length, subjectCols);

  // Grand total summary row.
  doc.setFillColor(245, 245, 245);
  doc.rect(left, rowY, width, dataRowHeight + 2, "F");
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(left, rowY, right, rowY);
  drawRow(
    doc,
    left,
    rowY + 1,
    dataRowHeight,
    [subjectCols[0]!, subjectCols[1]!],
    ["Grand Total Summary", String(report.totalFullMarks)],
    { bold: true, fontSize: 9 },
  );
  const obtainedX = left + subjectCols.slice(0, 4).reduce((a, b) => a + b, 0);
  drawRow(doc, obtainedX, rowY + 1, dataRowHeight, [subjectCols[4]! + 6], ["Total Obtained:"], {
    fontSize: 8,
    color: MUTED,
  });
  drawRow(
    doc,
    obtainedX + subjectCols[4]! + 6,
    rowY + 1,
    dataRowHeight,
    [subjectCols[5]! - 6],
    [String(report.totalObtained)],
    { bold: true, fontSize: 9, color: [20, 120, 85] },
  );
  const gpaLabelX = left + subjectCols.slice(0, 6).reduce((a, b) => a + b, 0);
  drawRow(doc, gpaLabelX, rowY + 1, dataRowHeight, [subjectCols[6]! + subjectCols[7]!], ["Overall GPA:"], {
    fontSize: 8,
    color: MUTED,
  });
  drawRow(
    doc,
    gpaLabelX + subjectCols[6]! + subjectCols[7]! - 20,
    rowY + 1,
    dataRowHeight,
    [subjectCols[8]! + 20],
    [`${report.gpa.toFixed(2)} (${report.letterGrade})`],
    { bold: true, fontSize: 9, color: [20, 120, 85] },
  );
  rowY += dataRowHeight + 2;
  y = rowY + 16;

  // Signature lines.
  const sigWidth = (width - 20) / 3;
  [
    ["Class Teacher's Signature", left],
    ["Guardian's Signature", left + sigWidth + 10],
    ["Principal's Signature", left + 2 * (sigWidth + 10)],
  ].forEach(([label, x]) => {
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.3);
    doc.line(x as number, y, (x as number) + sigWidth, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label as string, x as number, y + 5);
  });
  doc.setTextColor(0, 0, 0);

  const filename = `progress-report-${report.studentCode}-${report.academicYear}.pdf`.replace(/\s+/g, "-");
  doc.save(filename);
}
