import { jsPDF } from "jspdf";
import { getToken } from "@/lib/api";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import type { StudentFeeDto } from "@/lib/finance-api";
import { studentPhotoProxyUrl, type StudentDto } from "@/lib/students-api";

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

export async function downloadAdmitCardPdf(
  fee: StudentFeeDto,
  student: StudentDto,
  phone: string | null | undefined,
  photoUrl: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const left = 14;
  const right = 134; // A5 landscape-ish width minus margin (a5 portrait is 148mm wide)
  const cardTop = 10;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, cardTop, right - left, 190, 2, 2);

  // Full-color logo watermark, centered behind the fields — low opacity
  // (not grayscale) via jsPDF's graphics state, so it stays colorful rather
  // than a faded monochrome stamp. Drawn right after the border so every
  // later field/text draws on top of it.
  const logoDataUrl = await loadImageAsDataUrl(SCHOOL_LOGO);
  if (logoDataUrl) {
    const cardW = right - left;
    const cardH = 190;
    const wmSize = cardW * 0.65;
    try {
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.16 }));
      doc.addImage(
        logoDataUrl,
        "JPEG",
        left + (cardW - wmSize) / 2,
        cardTop + (cardH - wmSize) / 2,
        wmSize,
        wmSize,
      );
      doc.restoreGraphicsState();
    } catch {
      // Unsupported format or corrupt data — card still works without it.
    }
  }

  // Photo, top-left — drawn first so the header text column's width (and
  // therefore its wrapping) is computed around it, never the other way
  // around. A long school name wraps onto another line instead of
  // overlapping the photo or running off the card.
  const photoW = 26;
  const photoH = 32;
  const photoX = left + 5;
  const photoY = cardTop + 6;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.rect(photoX, photoY, photoW, photoH);
  if (photoUrl) {
    // Routed through the backend's own proxy (not fetched from the storage
    // bucket directly) since the bucket sends no CORS headers — see
    // studentPhotoProxyUrl's comment. Needs the same bearer token the rest
    // of the authenticated API calls use.
    const token = getToken();
    const dataUrl = await loadImageAsDataUrl(
      studentPhotoProxyUrl(student.id),
      token ? { Authorization: `Bearer ${token}` } : undefined,
    );
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "JPEG", photoX, photoY, photoW, photoH);
      } catch {
        // Unsupported format or corrupt data — leave the empty box.
      }
    }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("PHOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const textLeft = photoX + photoW + 6;
  const textWidth = right - 4 - textLeft;
  let y = photoY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(SCHOOL_NAME, textWidth);
  doc.text(nameLines, textLeft, y);
  y += nameLines.length * 5.2;

  if (phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`TEL.#${phone}`, textLeft, y);
    y += 5.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ADMIT CARD", textLeft, y);
  y += 6;

  const examLabel = fee.examName ?? "";
  if (examLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const examLines = doc.splitTextToSize(examLabel, textWidth);
    doc.text(examLines, textLeft, y);
    y += examLines.length * 5;
  }

  // Resume full card width once past whichever of the photo or the (now
  // variable-height) header text block is taller.
  y = Math.max(y, photoY + photoH) + 10;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(left + 4, y, right - 4, y);
  y += 10;

  const lineGap = 9;
  const fieldWidth = right - left - 8;

  function field(label: string, value: string, x = left + 4, width = fieldWidth) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + labelWidth + 3, y);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.2);
    doc.line(x + labelWidth + 1, y + 1.3, x + width - 4, y + 1.3);
  }

  function fieldRow(entries: Array<[string, string]>) {
    const colWidth = fieldWidth / entries.length;
    entries.forEach(([label, value], i) => field(label, value, left + 4 + i * colWidth, colWidth));
    y += lineGap;
  }

  fieldRow([["Student's Name:", student.name]]);
  fieldRow([
    ["Roll No:", String(student.roll)],
    ["Class:", student.classEntity.name],
    ["Section:", student.section.name],
  ]);

  y += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(left + 4, y, right - 4, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const declaration =
    "This is to certify that the above named student has paid the examination fee in full and is hereby permitted to sit for the examination.";
  const wrapped = doc.splitTextToSize(declaration, right - left - 8);
  doc.text(wrapped, left + 4, y);
  y += wrapped.length * 5 + 20;

  doc.setLineWidth(0.2);
  doc.line(left + 6, y, left + 46, y);
  doc.line(right - 46, y, right - 6, y);
  doc.setFontSize(8.5);
  doc.text("Class Teacher", left + 6, y + 5);
  doc.text("Head Teacher", right - 46, y + 5);

  const filename = `admit-card-${student.code}-${examLabel || "exam"}.pdf`.replace(/\s+/g, "-");
  doc.save(filename);
}
