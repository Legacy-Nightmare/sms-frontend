import { jsPDF } from "jspdf";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { drawName, loadNameFonts } from "@/lib/pdf-fonts";
import type { FeeStatus, PaymentDto, TeacherSalaryDto } from "@/lib/finance-api";

// Mirrors receipt-pdf.ts's drawCopy — same branded-card layout, swapped to
// teacher-salary fields. See that file for the WinAnsi-glyph reasoning
// behind moneyPdf/truncateToWidth/the plain-word stamp.
function moneyPdf(n: number) {
  return `Tk ${n.toLocaleString("en-BD")}`;
}

function truncateToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAGE_WIDTH = 210;
const MARGIN = 16;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
const COPY_HEIGHT = 122;

const NAVY: [number, number, number] = [22, 40, 92];
const BORDER: [number, number, number] = [222, 226, 230];
const MUTED: [number, number, number] = [110, 118, 128];
const GREEN: [number, number, number] = [16, 66, 50];
const GREEN_TINT: [number, number, number] = [224, 242, 234];
const BLUE: [number, number, number] = [19, 84, 140];
const BLUE_TINT: [number, number, number] = [219, 236, 248];
const ORANGE: [number, number, number] = [196, 120, 28];
const RED: [number, number, number] = [179, 42, 34];

const STAMP: Record<FeeStatus, { label: string; color: [number, number, number] }> = {
  PAID: { label: "PAID", color: GREEN },
  PARTIAL: { label: "PARTIAL", color: ORANGE },
  UNPAID: { label: "DUE", color: RED },
};

function tableRow(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  label: string,
  value: string,
  opts?: {
    last?: boolean;
    highlight?: [number, number, number] | undefined;
    textColor?: [number, number, number] | undefined;
  },
) {
  if (opts?.highlight) {
    doc.setFillColor(...opts.highlight);
    doc.rect(x, y, width, rowHeight, "F");
  }
  const textColor = opts?.textColor ?? [20, 20, 20];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...(opts?.highlight ? textColor : MUTED));
  doc.text(label, x + 4, y + rowHeight / 2 + 1.3);
  doc.setTextColor(...textColor);
  doc.text(value, x + width - 4, y + rowHeight / 2 + 1.3, { align: "right" });
  if (!opts?.last) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(x, y + rowHeight, x + width, y + rowHeight);
  }
  doc.setTextColor(0, 0, 0);
}

async function drawCopy(
  doc: jsPDF,
  top: number,
  copyLabel: string,
  payment: PaymentDto,
  salary: TeacherSalaryDto,
  logoDataUrl: string | null,
) {
  const left = MARGIN;
  const right = CONTENT_RIGHT;
  const width = right - left;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, top, width, COPY_HEIGHT, 3, 3);

  // Full-color logo watermark, low opacity — same technique as
  // admit-card-pdf.ts — drawn right after the border so everything else
  // paints on top of it.
  if (logoDataUrl) {
    const wmSize = width * 0.5;
    try {
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.1 }));
      doc.addImage(
        logoDataUrl,
        "JPEG",
        left + (width - wmSize) / 2,
        top + (COPY_HEIGHT - wmSize) / 2,
        wmSize,
        wmSize,
      );
      doc.restoreGraphicsState();
    } catch {
      // Unsupported format — card still works without it.
    }
  }

  // Copy tag, top-right.
  const tagW = 34;
  doc.setFillColor(...NAVY);
  doc.roundedRect(right - tagW, top + 4, tagW, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(copyLabel.toUpperCase(), right - tagW / 2, top + 8.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Header: logo + school name.
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "JPEG", left + 4, top + 4, 14, 14);
    } catch {
      // Unsupported format — header still works without it.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(SCHOOL_NAME, left + 22, top + 12);
  doc.setTextColor(0, 0, 0);

  // "Salary Receipt" pill with a divider line either side.
  const pillY = top + 25;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(left + 4, pillY, left + 65, pillY);
  doc.line(right - 65, pillY, right - 4, pillY);
  doc.setFillColor(...NAVY);
  doc.roundedRect((left + right) / 2 - 24, pillY - 4, 48, 8, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Salary Receipt", (left + right) / 2, pillY + 1, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Info bar: Teacher's Name / Employee ID / Designation / Date.
  const infoTop = top + 31;
  const infoHeight = 11;
  const employeeId = `T-${String(salary.teacherId).padStart(4, "0")}`;
  const designation = salary.teacherSubject ? `${salary.teacherSubject} Teacher` : "Teacher";
  doc.setFillColor(243, 245, 250);
  doc.roundedRect(left + 4, infoTop, width - 8, infoHeight, 2, 2, "F");
  const infoItems: [string, string][] = [
    ["Teacher's Name", salary.teacherName],
    ["Employee ID", employeeId],
    ["Designation", designation],
    ["Date", payment.paidAt],
  ];
  // The name column is wider than the rest so a long name stays on one line.
  const colWs = [0.4, 0.25, 0.15, 0.2].map((f) => f * (width - 8));
  infoItems.forEach(([label, value], i) => {
    const colX = left + 4 + colWs.slice(0, i).reduce((a, b) => a + b, 0);
    const colW = colWs[i] ?? 0;
    if (i > 0) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(colX, infoTop + 1.5, colX, infoTop + infoHeight - 1.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, colX + 5, infoTop + 4.5);
    if (i === 0) {
      drawName(doc, value, colX + 5, infoTop + 8.5, colW - 10, { sizePt: 9, minPt: 7 });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(truncateToWidth(doc, value, colW - 10), colX + 5, infoTop + 8.5);
    }
  });

  // Totals table (left) + status stamp (right).
  const salaryMonth = `${MONTH_NAMES[salary.periodMonth - 1]} ${salary.periodYear}`;
  const tableTop = top + 47;
  const rowH = 7.5;
  const stampColW = 38;
  const tableW = width - 8 - stampColW;
  const previousDues = 0;
  const rows: [string, string, "green" | "blue" | undefined][] = [
    ["Salary Month", salaryMonth, "blue"],
    ["Monthly Salary", moneyPdf(salary.amountDue), undefined],
    ["Previous Dues", moneyPdf(previousDues), undefined],
    ["Received", moneyPdf(payment.amount), undefined],
    ["Remaining Dues", moneyPdf(salary.remaining), "green"],
  ];
  rows.forEach(([label, value, highlight], i) => {
    tableRow(doc, left + 4, tableTop + i * rowH, tableW, rowH, label, value, {
      last: i === rows.length - 1,
      highlight: highlight === "green" ? GREEN_TINT : highlight === "blue" ? BLUE_TINT : undefined,
      textColor: highlight === "green" ? GREEN : highlight === "blue" ? BLUE : undefined,
    });
  });
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(left + 4, tableTop, tableW, rowH * rows.length, 2, 2);

  // Status stamp: a rotated word inside a double ring, colored by salary status.
  const stamp = STAMP[salary.status];
  const stampCx = left + 4 + tableW + stampColW / 2;
  const stampCy = tableTop + (rowH * rows.length) / 2;
  const stampR = 15;
  doc.setDrawColor(...stamp.color);
  doc.setLineWidth(0.6);
  doc.circle(stampCx, stampCy, stampR, "S");
  doc.circle(stampCx, stampCy, stampR - 1.6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...stamp.color);
  doc.text(stamp.label, stampCx, stampCy + 1.5, { align: "center", angle: 12 });
  doc.setTextColor(0, 0, 0);

  // Footer: Paid By (left) + Signature line (right).
  const footerY = top + 100;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Paid By", left + 4, footerY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("APHS Authority", left + 4, footerY + 4.5);

  const sigRight = right - 4;
  const sigLeft = sigRight - 42;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.2);
  doc.line(sigLeft, footerY + 3, sigRight, footerY + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Signature", (sigLeft + sigRight) / 2, footerY + 7, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Receipt number ribbon, bottom-left corner.
  if (payment.receiptNumber) {
    doc.setFillColor(...NAVY);
    doc.roundedRect(left, top + COPY_HEIGHT - 7, 56, 7, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Receipt No.: ${payment.receiptNumber}`, left + 4, top + COPY_HEIGHT - 2.5);
    doc.setTextColor(0, 0, 0);
  }
}

export async function downloadSalaryReceiptPdf(payment: PaymentDto, salary: TeacherSalaryDto) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const [logoDataUrl] = await Promise.all([loadImageAsDataUrl(SCHOOL_LOGO), loadNameFonts()]);

  await drawCopy(doc, 16, "Teacher Copy", payment, salary, logoDataUrl);

  const cutY = 16 + COPY_HEIGHT + 10;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(MARGIN, cutY, CONTENT_RIGHT, cutY);
  doc.setLineDashPattern([], 0);
  // "✂" isn't in jsPDF's default WinAnsi-only font (F-05) — plain ASCII
  // label instead, same as receipt-pdf.ts.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text("CUT HERE", (MARGIN + CONTENT_RIGHT) / 2, cutY - 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  await drawCopy(doc, cutY + 10, "Office Copy", payment, salary, logoDataUrl);

  const filename = `salary-receipt-${payment.receiptNumber ?? salary.teacherId}-${payment.paidAt}.pdf`;
  doc.save(filename);
}
