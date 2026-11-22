import { jsPDF } from "jspdf";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { drawName, loadNameFonts } from "@/lib/pdf-fonts";
import type { FeeStatus, PaymentDto, StudentFeeDto } from "@/lib/finance-api";

// jsPDF's built-in fonts (Helvetica/Times/Courier) only cover WinAnsi —
// there's no glyph for ৳, so it would render as a broken box in the PDF.
// "Tk" is the standard ASCII fallback for Bangladeshi taka in plain-text
// contexts; the on-screen/print version keeps the real ৳ symbol since the
// browser renders that fine. Same reason the stamp below uses a plain
// rotated word instead of the on-screen version's ★ star glyphs.
function moneyPdf(n: number) {
  return `Tk ${n.toLocaleString("en-BD")}`;
}

// jsPDF's maxWidth option wraps onto a second line instead of truncating,
// which overflows a fixed-height info-bar cell for a long name — ASCII
// "..." rather than the unicode ellipsis, same WinAnsi-glyph reasoning as
// moneyPdf above.
function truncateToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

// Same fetch+FileReader data-URL technique as admit-card-pdf.ts.
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
const COPY_HEIGHT = 129;

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
  fee: StudentFeeDto,
  phone: string | null | undefined,
  logoDataUrl: string | null,
) {
  const left = MARGIN;
  const right = CONTENT_RIGHT;
  const width = right - left;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, top, width, COPY_HEIGHT, 3, 3);

  // Full-color logo watermark, low opacity (not grayscale) via jsPDF's
  // graphics state — same technique as admit-card-pdf.ts — drawn right
  // after the border so everything else paints on top of it.
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

  // Header: logo + school name + phone.
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
  doc.text(SCHOOL_NAME, left + 22, top + 10);
  if (phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`TEL. #${phone}`, left + 22, top + 16);
  }
  doc.setTextColor(0, 0, 0);

  // "Fee Receipt" pill with a divider line either side.
  const pillY = top + 25;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(left + 4, pillY, left + 70, pillY);
  doc.line(right - 70, pillY, right - 4, pillY);
  doc.setFillColor(...NAVY);
  doc.roundedRect((left + right) / 2 - 20, pillY - 4, 40, 8, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Fee Receipt", (left + right) / 2, pillY + 1, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Info bar: Student's Name / Class / Roll No / Date.
  const infoTop = top + 31;
  const infoHeight = 11;
  doc.setFillColor(...[243, 245, 250]);
  doc.roundedRect(left + 4, infoTop, width - 8, infoHeight, 2, 2, "F");
  const infoItems: [string, string][] = [
    ["Student's Name", fee.studentName],
    ["Class", `${fee.className} · ${fee.sectionName}`],
    ["Roll No", String(fee.roll)],
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

  // Totals table (left) + status stamp (right). The period/exam row is
  // its own highlighted line (not folded into the Fee Type label) so it's
  // unmistakable which month — or which exam — this receipt is for.
  const periodLabel = fee.examName
    ? (["Exam", fee.examName] as const)
    : fee.periodMonth
      ? (["Billing Period", `${MONTH_NAMES[fee.periodMonth - 1]} ${fee.periodYear}`] as const)
      : null;
  const tableTop = top + 47;
  const rowH = 7.5;
  const stampColW = 38;
  const tableW = width - 8 - stampColW;
  const previousDues = 0;
  const rows: [string, string, "green" | "blue" | undefined][] = [
    ["Fee Type", fee.feeTypeName, undefined],
  ];
  if (periodLabel) rows.push([periodLabel[0], periodLabel[1], "blue"]);
  rows.push(
    ["Previous Dues", moneyPdf(previousDues), undefined],
    ["Total Dues", moneyPdf(fee.amountDue), undefined],
    ["Received", moneyPdf(payment.amount), undefined],
    ["Remaining Dues", moneyPdf(fee.remaining), "green"],
  );
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

  // Status stamp: a rotated word inside a double ring, colored by fee status.
  const stamp = STAMP[fee.status];
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

  // Footer: Received By (left) + Signature line (right).
  const footerY = top + 102;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Received By", left + 4, footerY);
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

export async function downloadReceiptPdf(
  payment: PaymentDto,
  fee: StudentFeeDto,
  phone: string | null | undefined,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const [logoDataUrl] = await Promise.all([loadImageAsDataUrl(SCHOOL_LOGO), loadNameFonts()]);

  await drawCopy(doc, 16, "Student Copy", payment, fee, phone, logoDataUrl);

  const cutY = 16 + COPY_HEIGHT + 10;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(MARGIN, cutY, CONTENT_RIGHT, cutY);
  doc.setLineDashPattern([], 0);
  // "✂" isn't in jsPDF's default WinAnsi-only font (F-05 — it rendered as
  // a stray garbage glyph), so this uses a plain ASCII label instead, same
  // reasoning as moneyPdf/the status stamp above.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text("CUT HERE", (MARGIN + CONTENT_RIGHT) / 2, cutY - 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  await drawCopy(doc, cutY + 10, "Authority Copy", payment, fee, phone, logoDataUrl);

  const filename = `receipt-${payment.receiptNumber ?? fee.studentCode}-${payment.paidAt}.pdf`;
  doc.save(filename);
}
