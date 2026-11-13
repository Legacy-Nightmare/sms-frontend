import { jsPDF } from "jspdf";
import { SCHOOL_NAME } from "@/lib/school-info";
import type { PaymentDto, StudentFeeDto } from "@/lib/finance-api";

// jsPDF's built-in fonts (Helvetica/Times/Courier) only cover WinAnsi —
// there's no glyph for ৳, so it would render as a broken box in the PDF.
// "Tk" is the standard ASCII fallback for Bangladeshi taka in plain-text
// contexts; the on-screen/print version keeps the real ৳ symbol since the
// browser renders that fine.
function moneyPdf(n: number) {
  return `Tk ${n.toLocaleString("en-BD")}`;
}

const PAGE_WIDTH = 210;
const MARGIN = 16;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
const COL2_X = 118;

function fieldLine(doc: jsPDF, x: number, y: number, endX: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(label, x, y);
  const labelWidth = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  doc.text(value, x + labelWidth + 3, y);
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.2);
  doc.line(x + labelWidth + 1, y + 1.3, endX, y + 1.3);
}

function drawCopy(
  doc: jsPDF,
  top: number,
  copyLabel: string,
  payment: PaymentDto,
  fee: StudentFeeDto,
  phone: string | null | undefined,
) {
  const height = 122;
  const left = MARGIN;
  const right = CONTENT_RIGHT;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, top, right - left, height, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(copyLabel.toUpperCase(), right - 4, top + 7, { align: "right" });

  doc.setFontSize(16);
  doc.text("School's Fee Receipt", (left + right) / 2, top + 11, { align: "center" });
  doc.setFontSize(10);
  doc.text(SCHOOL_NAME, (left + right) / 2, top + 17, { align: "center" });
  if (phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`TEL.#${phone}`, (left + right) / 2, top + 22, { align: "center" });
  }

  const previousDues = fee.remaining + payment.amount;
  const feeTypeLabel = fee.periodMonth
    ? `${fee.feeTypeName} — ${fee.periodMonth}/${fee.periodYear}`
    : fee.feeTypeName;

  let y = top + 33;
  fieldLine(doc, COL2_X, y, right - 4, "Date", payment.paidAt);

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Student's Name", fee.studentName);
  fieldLine(doc, COL2_X, y, right - 4, "Class", `${fee.className} · ${fee.sectionName}`);

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Roll No", String(fee.roll));

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Fee Type", feeTypeLabel);
  fieldLine(doc, COL2_X, y, right - 4, "Previous Dues", moneyPdf(previousDues));

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Total Dues", moneyPdf(fee.amountDue));
  fieldLine(doc, COL2_X, y, right - 4, "Received", moneyPdf(payment.amount));

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Remaining Dues", moneyPdf(fee.remaining));

  y += 10;
  fieldLine(doc, left + 4, y, COL2_X - 10, "Received By", "APHS Authority");
  fieldLine(doc, COL2_X, y, right - 4, "Signature", "");

  if (payment.receiptNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Receipt No. ${payment.receiptNumber}`, right - 4, top + height - 4, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }
}

export function downloadReceiptPdf(
  payment: PaymentDto,
  fee: StudentFeeDto,
  phone: string | null | undefined,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawCopy(doc, 16, "Student Copy", payment, fee, phone);

  const cutY = 16 + 122 + 10;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(MARGIN, cutY, CONTENT_RIGHT, cutY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("✂", (MARGIN + CONTENT_RIGHT) / 2, cutY + 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  drawCopy(doc, cutY + 10, "Authority Copy", payment, fee, phone);

  const filename = `receipt-${payment.receiptNumber ?? fee.studentCode}-${payment.paidAt}.pdf`;
  doc.save(filename);
}
