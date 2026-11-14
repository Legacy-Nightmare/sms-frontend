import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_NAME } from "@/lib/school-info";
import { MONTHS } from "@/lib/month-year-options";
import { fetchSchoolProfile } from "@/lib/website-api";
import { studentPhotoUrl, type StudentDto } from "@/lib/students-api";
import { downloadAdmitCardPdf } from "@/lib/admit-card-pdf";
import type { StudentFeeDto } from "@/lib/finance-api";

function fatherOrGuardianName(student: StudentDto): string {
  const father = student.guardians.find((g) => g.relation === "father");
  const any = father ?? student.guardians[0];
  return any?.name ?? "—";
}

export function AdmitCardDialog({
  fee,
  student,
  onClose,
}: {
  fee: StudentFeeDto;
  student: StudentDto;
  onClose: () => void;
}) {
  const profile = useQuery({ queryKey: ["school-profile"], queryFn: fetchSchoolProfile });
  const [downloading, setDownloading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const photoUrl = studentPhotoUrl(student.photoUrl);
  const examLabel = fee.periodMonth
    ? `${MONTHS[fee.periodMonth - 1]}, ${fee.periodYear}`
    : String(fee.periodYear ?? "");

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAdmitCardPdf(fee, student, profile.data?.phone, photoUrl);
    } catch {
      toast.error("Couldn't generate the admit card PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="print-dialog" style={{ maxWidth: 480 }}>
        <div className="print-area">
          <div className="admit-card">
            <div className="admit-card-photo">
              {photoUrl && !photoFailed ? (
                <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} />
              ) : (
                <span>Photo</span>
              )}
            </div>
            <div className="receipt-header">
              <p style={{ fontWeight: 700, fontSize: 15 }}>{SCHOOL_NAME}</p>
              {profile.data?.phone && <p>TEL.#{profile.data.phone}</p>}
              <h2 style={{ marginTop: 8 }}>Admit Card</h2>
              {examLabel && <p>Examination: {examLabel}</p>}
            </div>

            <div className="receipt-field">
              <span className="receipt-label">Student&rsquo;s Name</span>
              <span className="receipt-value">{student.name}</span>
            </div>
            <div className="receipt-row">
              <div className="receipt-field">
                <span className="receipt-label">Student ID</span>
                <span className="receipt-value mono">{student.code}</span>
              </div>
              <div className="receipt-field">
                <span className="receipt-label">Roll No</span>
                <span className="receipt-value mono">{student.roll}</span>
              </div>
            </div>
            <div className="receipt-field">
              <span className="receipt-label">Class</span>
              <span className="receipt-value">
                {student.classEntity.name} · {student.section.name}
              </span>
            </div>
            <div className="receipt-field">
              <span className="receipt-label">Father&rsquo;s/Guardian&rsquo;s Name</span>
              <span className="receipt-value">{fatherOrGuardianName(student)}</span>
            </div>

            <p className="admit-card-declaration">
              This is to certify that the above named student has paid the examination fee in
              full and is hereby permitted to sit for the examination.
            </p>

            <div className="admit-card-signatures">
              <div>
                <div className="admit-card-signature-line" />
                Class Teacher
              </div>
              <div>
                <div className="admit-card-signature-line" />
                Head Teacher
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={handleDownload} disabled={downloading}>
            <Download size={14} />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
