import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { getToken } from "@/lib/api";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { BENGALI_FONT, registerBengaliFont } from "@/lib/pdf-fonts";
import { studentPhotoProxyUrl } from "@/lib/students-api";

// Flat, source-agnostic shape — deliberately NOT StudentDto/StudentFeeDto,
// since the public admit-card download page (no admin session, no access
// to the authenticated /students or /finance APIs) builds this from its
// own plain JSON response instead. The admin dialog builds the same shape
// from its StudentDto/StudentFeeDto.
export interface AdmitCardData {
  studentName: string;
  studentCode: string;
  roll: number;
  className: string;
  sectionName: string;
  examName: string | null;
}

// Fetches an image and converts it to a data URL so jsPDF's addImage (which
// needs base64, not a URL) can embed it. Cross-origin hosts that don't send
// permissive CORS headers will fail here — caught by the caller, which just
// omits the image rather than blocking the whole PDF over it.
async function loadImageAsDataUrl(url: string, headers?: HeadersInit): Promise<string | null> {
  try {
    const res = await fetch(url, headers ? { mode: "cors", headers } : { mode: "cors" });
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

// Admin-only: resolves a student's photo through the backend's authenticated
// proxy (bearer token required — see students.controller.ts's reasoning for
// why this can't be a plain <img>-style fetch). The public download page has
// no admin session, so it never calls this — its photo arrives pre-resolved
// as a data URL straight from the backend's public response instead.
export async function loadStudentPhotoDataUrl(studentId: number): Promise<string | null> {
  const token = getToken();
  return loadImageAsDataUrl(
    studentPhotoProxyUrl(studentId),
    token ? { Authorization: `Bearer ${token}` } : undefined,
  );
}

// Plain real identity/exam facts (no fabricated data) — shared with
// admit-card-dialog.tsx and the public download page so the on-screen QR
// and the downloaded one always encode the same thing.
export function admitCardQrPayload(data: AdmitCardData): string {
  return [
    SCHOOL_NAME,
    "Admit Card",
    `Student: ${data.studentName}`,
    `Roll: ${data.roll}`,
    `Class: ${data.className} - ${data.sectionName}`,
    `Exam: ${data.examName ?? "Examination"}`,
  ].join("\n");
}

const NAVY: [number, number, number] = [22, 40, 92];
const GOLD: [number, number, number] = [200, 162, 39];
const MUTED: [number, number, number] = [110, 118, 128];

// Standard admit-card instructions — generic school-admin boilerplate, not
// data about this specific student, so safe to hardcode here and in the
// on-screen version.
export const ADMIT_CARD_NOTES = [
  "Keep this admit card safe — do not lose or damage it.",
  "This card must be shown at the exam hall; entry is not permitted without it.",
  "Issued only after full payment of the examination fee.",
  "Arrive at the exam hall at least 15 minutes before the scheduled time.",
  "Report any loss or damage to the school office immediately for a reissue.",
];

function truncateToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

export async function downloadAdmitCardPdf(
  data: AdmitCardData,
  phone: string | null | undefined,
  photoDataUrl: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  await registerBengaliFont(doc);
  const left = 14;
  const right = 134; // A5 portrait is 148mm wide
  const top = 10;
  const pageHeight = 190; // top=10 to bottom=200, leaving a 10mm page margin
  const cardHeight = pageHeight * 0.7; // the card itself — the rest is notes, below
  const width = right - left;
  const examLabel = data.examName ?? "";

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.roundedRect(left, top, width, cardHeight, 4, 4);

  // Full-color crest watermark, centered — low opacity (not grayscale) via
  // jsPDF's graphics state, drawn right after the border so every later
  // field/text draws on top of it.
  const logoDataUrl = await loadImageAsDataUrl(SCHOOL_LOGO);
  if (logoDataUrl) {
    const wmSize = width * 0.34;
    try {
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.11 }));
      doc.addImage(
        logoDataUrl,
        "JPEG",
        left + (width - wmSize) / 2,
        top + cardHeight * 0.72 - wmSize / 2,
        wmSize,
        wmSize,
      );
      doc.restoreGraphicsState();
    } catch {
      // Unsupported format or corrupt data — card still works without it.
    }
  }

  // Decorative corner ribbon, top-right: layered navy/gold/navy triangles,
  // kept narrow enough to clear the header text below.
  doc.setFillColor(...NAVY);
  doc.triangle(right, top, right, top + 24, right - 36, top, "F");
  doc.setFillColor(...GOLD);
  doc.triangle(right, top + 4, right, top + 18, right - 28, top + 4, "F");
  doc.setFillColor(...NAVY);
  doc.triangle(right, top + 8, right, top + 14, right - 20, top + 8, "F");

  // Header: logo + school name + phone.
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "JPEG", left + 5, top + 4, 13, 13);
    } catch {
      // Unsupported format — header still works without it.
    }
  }
  const headerLeft = left + 21;
  const headerRight = right - 40;
  const headerMid = (headerLeft + headerRight) / 2;
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  const nameLines = doc.splitTextToSize(SCHOOL_NAME, headerRight - headerLeft);
  doc.text(nameLines, headerMid, top + 8, { align: "center" });
  let headerY = top + 8 + (nameLines.length - 1) * 4.8;
  if (phone) {
    headerY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`TEL. #${phone}`, headerMid, headerY, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);

  // "ADMIT CARD" pill, gold-bordered, flanked by short gold lines.
  const pillY = top + 21;
  const pillW = 54;
  const pillH = 9;
  const pillX = (left + right) / 2 - pillW / 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(left + 7, pillY + pillH / 2, pillX - 5, pillY + pillH / 2);
  doc.line(pillX + pillW + 5, pillY + pillH / 2, right - 7, pillY + pillH / 2);
  doc.setFillColor(...GOLD);
  doc.roundedRect(pillX - 1, pillY - 1, pillW + 2, pillH + 2, 4, 4, "F");
  doc.setFillColor(...NAVY);
  doc.roundedRect(pillX, pillY, pillW, pillH, 3.5, 3.5, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("ADMIT CARD", (left + right) / 2, pillY + pillH / 2 + 2, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Exam title, flanked by short navy lines.
  let y = pillY + pillH + 6;
  if (examLabel) {
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.25);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    const examW = doc.getTextWidth(examLabel);
    const examMid = (left + right) / 2;
    doc.line(left + 10, y, examMid - examW / 2 - 6, y);
    doc.line(examMid + examW / 2 + 6, y, right - 10, y);
    doc.text(examLabel, examMid, y + 1.2, { align: "center" });
    y += 6;
  } else {
    y += 3;
  }

  // Photo (left) + info rows (right): Student's Name / Roll No / Class / Section.
  const rowH = 9;
  const infoRows = 4;
  const photoH = infoRows * rowH;
  const photoW = 32;
  const photoX = left + 6;
  const photoY = y;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.rect(photoX, photoY, photoW, photoH);
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, "JPEG", photoX, photoY, photoW, photoH);
    } catch {
      // Unsupported format or corrupt data — leave the empty box.
    }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("PHOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const infoX = photoX + photoW + 8;
  const infoRight = right - 6;
  const infoW = infoRight - infoX;
  const rows: [string, string][] = [
    ["Student's Name:", data.studentName],
    ["Roll No:", String(data.roll)],
    ["Class:", `${data.className} · ${data.sectionName}`],
    ["Section:", data.sectionName],
  ];
  rows.forEach(([label, value], i) => {
    const rowY = photoY + i * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, infoX, rowY + 3.5);
    // F-04: Student's Name may be Bangla — Helvetica can't render that script.
    doc.setFont(label === "Student's Name:" ? BENGALI_FONT : "helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(truncateToWidth(doc, value, infoW), infoX, rowY + 7.2);
    if (i < rows.length - 1) {
      doc.setDrawColor(222, 226, 230);
      doc.setLineWidth(0.2);
      doc.line(infoX, rowY + rowH - 0.4, infoRight, rowY + rowH - 0.4);
    }
  });

  y = photoY + photoH + 4;

  // Certify box: bordered rect with a pill label straddling its top edge.
  const boxTop = y;
  const boxH = 17;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(left + 6, boxTop, width - 12, boxH, 3, 3);
  const certPillW = 50;
  const certPillH = 7;
  doc.setFillColor(...NAVY);
  doc.roundedRect((left + right) / 2 - certPillW / 2, boxTop - certPillH / 2, certPillW, certPillH, 3.5, 3.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("This is to certify that", (left + right) / 2, boxTop + 1.4, { align: "center" });
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const declaration =
    "the above named student has paid the examination fee in full and is hereby permitted to sit for the examination.";
  const wrapped = doc.splitTextToSize(declaration, width - 24);
  doc.text(wrapped, (left + right) / 2, boxTop + 10, { align: "center" });

  y = boxTop + boxH + 13;

  // Signature row: Class Teacher (left) + QR code (center) + Head Teacher (right).
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(left + 8, y, left + 38, y);
  doc.line(right - 38, y, right - 8, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Class Teacher", left + 8, y + 4.5);
  doc.text("Head Teacher", right - 38, y + 4.5);

  try {
    const qrDataUrl = await QRCode.toDataURL(admitCardQrPayload(data), {
      margin: 1,
      width: 160,
      color: { dark: "#16285c", light: "#ffffff" },
    });
    const qrSize = 13;
    doc.addImage(qrDataUrl, "PNG", (left + right) / 2 - qrSize / 2, y - qrSize + 2.5, qrSize, qrSize);
  } catch {
    // QR generation failed — signatures and the rest of the card still work.
  }

  // Footer band.
  const footerY = top + cardHeight - 11;
  const footerH = 7;
  doc.setFillColor(...NAVY);
  doc.roundedRect(left + 6, footerY, width - 12, footerH, footerH / 2, footerH / 2, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(left + 14, footerY + footerH / 2, (left + right) / 2 - 22, footerY + footerH / 2);
  doc.line((left + right) / 2 + 22, footerY + footerH / 2, right - 14, footerY + footerH / 2);
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Knowledge is Power", (left + right) / 2, footerY + footerH / 2 + 1.3, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Important notes — the remaining 30% of the page, below the card.
  const notesTop = top + cardHeight + 6;
  const notesHeight = pageHeight - cardHeight - 6;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.roundedRect(left, notesTop, width, notesHeight, 3, 3);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("Important Notes", left + 6, notesTop + 7);
  doc.setTextColor(0, 0, 0);

  let noteY = notesTop + 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  ADMIT_CARD_NOTES.forEach((note, i) => {
    const wrappedNote = doc.splitTextToSize(`${i + 1}. ${note}`, width - 12);
    doc.text(wrappedNote, left + 6, noteY);
    noteY += wrappedNote.length * 4 + 1.5;
  });

  const filename = `admit-card-${data.studentCode}-${examLabel || "exam"}.pdf`.replace(/\s+/g, "-");
  doc.save(filename);
}
