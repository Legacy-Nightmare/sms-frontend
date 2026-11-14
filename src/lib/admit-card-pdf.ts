import { jsPDF } from "jspdf";
import { SCHOOL_NAME } from "@/lib/school-info";
import { MONTHS } from "@/lib/month-year-options";
import type { StudentFeeDto } from "@/lib/finance-api";
import type { StudentDto } from "@/lib/students-api";

// Fetches the photo and converts it to a data URL so jsPDF's addImage (which
// needs base64, not a URL) can embed it. Cross-origin photo hosts that don't
// send permissive CORS headers will fail here — caught by the caller, which
// just omits the photo rather than blocking the whole PDF over it.
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

function fatherOrGuardianName(student: StudentDto): string {
  const father = student.guardians.find((g) => g.relation === "father");
  const any = father ?? student.guardians[0];
  return any?.name ?? "—";
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
  const centerX = (left + right) / 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.roundedRect(left, 10, right - left, 190, 2, 2);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(SCHOOL_NAME, centerX, 20, { align: "center" });
  if (phone) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`TEL.#${phone}`, centerX, 25, { align: "center" });
  }

  doc.setLineWidth(0.3);
  doc.line(left + 4, 29, right - 4, 29);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ADMIT CARD", centerX, 38, { align: "center" });

  const examLabel = fee.periodMonth
    ? `${MONTHS[fee.periodMonth - 1]}, ${fee.periodYear}`
    : String(fee.periodYear ?? "");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (examLabel) {
    doc.text(`Examination: ${examLabel}`, centerX, 45, { align: "center" });
  }

  // Photo box, top-right of the detail area.
  const photoX = right - 32;
  const photoY = 52;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.rect(photoX, photoY, 26, 32);
  if (photoUrl) {
    const dataUrl = await loadImageAsDataUrl(photoUrl);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "JPEG", photoX, photoY, 26, 32);
      } catch {
        // Unsupported format or corrupt data — leave the empty box.
      }
    }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("PHOTO", photoX + 13, photoY + 17, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  let y = 60;
  const lineGap = 9;
  const fieldWidth = photoX - left - 10;

  function field(label: string, value: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, left + 4, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value, left + 4 + labelWidth + 3, y);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.2);
    doc.line(left + 4 + labelWidth + 1, y + 1.3, left + 4 + fieldWidth, y + 1.3);
    y += lineGap;
  }

  field("Student's Name:", student.name);
  field("Student ID:", student.code);
  field("Roll No:", String(student.roll));
  field("Class:", `${student.classEntity.name} · ${student.section.name}`);
  field("Father's/Guardian's Name:", fatherOrGuardianName(student));

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
