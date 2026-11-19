import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Download, GraduationCap, IdCard, Landmark, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { fetchSchoolProfile } from "@/lib/website-api";
import { studentPhotoUrl, type StudentDto } from "@/lib/students-api";
import { ADMIT_CARD_NOTES, admitCardQrPayload, downloadAdmitCardPdf } from "@/lib/admit-card-pdf";
import type { StudentFeeDto } from "@/lib/finance-api";

// A generic, non-identifying scribble — decoration standing in for a
// signature, not a stand-in for any real person's actual signature.
function SignatureScribble() {
  return (
    <svg viewBox="0 0 120 46" className="ac-scribble" aria-hidden="true">
      <path
        d="M6 34 C 16 8, 26 42, 36 20 C 44 4, 50 32, 60 16 C 68 4, 76 28, 88 12 C 96 2, 102 22, 114 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const photoUrl = studentPhotoUrl(student.photoUrl);
  const examLabel = fee.examName ?? "";

  useEffect(() => {
    QRCode.toDataURL(admitCardQrPayload(fee, student), {
      margin: 1,
      width: 160,
      color: { dark: "#16285c", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [fee, student]);

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
            <div className="ac-main">
            <svg className="ac-corner" viewBox="0 0 320 170" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
              <path d="M320 0 L320 120 C 250 70 210 55 120 0 Z" fill="#16285c" />
              <path d="M320 0 L320 95 C 260 55 225 42 150 0 Z" fill="#c8a227" />
              <path d="M320 0 L320 75 C 268 42 238 32 175 0 Z" fill="#16285c" />
              <g opacity="0.5" fill="#16285c">
                <rect x="150" y="40" width="10" height="60" />
                <rect x="165" y="55" width="8" height="45" />
                <rect x="178" y="30" width="12" height="70" />
                <rect x="195" y="48" width="9" height="52" />
                <rect x="210" y="20" width="14" height="80" />
                <rect x="229" y="42" width="10" height="58" />
                <rect x="244" y="35" width="11" height="65" />
                <rect x="260" y="50" width="9" height="50" />
                <rect x="274" y="25" width="13" height="75" />
                <rect x="292" y="45" width="10" height="55" />
              </g>
            </svg>

            <div className="ac-header">
              <img src={SCHOOL_LOGO} alt="" className="ac-logo" />
              <div className="ac-header-text">
                <h2>{SCHOOL_NAME}</h2>
                {profile.data?.phone && <p>TEL. #{profile.data.phone}</p>}
              </div>
            </div>

            <div className="ac-title-row">
              <span className="ac-gold-lines" />
              <span className="ac-title-pill">Admit Card</span>
              <span className="ac-gold-lines" />
            </div>

            {examLabel && (
              <div className="ac-subtitle-row">
                <span className="ac-navy-line" />
                <span className="ac-subtitle">{examLabel}</span>
                <span className="ac-navy-line" />
              </div>
            )}

            <div className="ac-body">
              <div className="ac-photo">
                {photoUrl && !photoFailed ? (
                  <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} />
                ) : (
                  <span>Photo</span>
                )}
              </div>
              <div className="ac-info">
                <div className="ac-info-row">
                  <span className="ac-info-icon">
                    <User size={14} />
                  </span>
                  <div>
                    <span>Student&rsquo;s Name:</span>
                    <strong>{student.name}</strong>
                  </div>
                </div>
                <div className="ac-info-row">
                  <span className="ac-info-icon">
                    <IdCard size={14} />
                  </span>
                  <div>
                    <span>Roll No:</span>
                    <strong>{student.roll}</strong>
                  </div>
                </div>
                <div className="ac-info-row">
                  <span className="ac-info-icon">
                    <GraduationCap size={14} />
                  </span>
                  <div>
                    <span>Class:</span>
                    <strong>
                      {student.classEntity.name} &middot; {student.section.name}
                    </strong>
                  </div>
                </div>
                <div className="ac-info-row">
                  <span className="ac-info-icon">
                    <Landmark size={14} />
                  </span>
                  <div>
                    <span>Section:</span>
                    <strong>{student.section.name}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="ac-certify">
              <span className="ac-certify-pill">This is to certify that</span>
              <p>
                the above named student has paid the examination fee in full and is hereby
                permitted to sit for the examination.
              </p>
            </div>

            <div className="ac-sign-row">
              <div className="ac-sign">
                <SignatureScribble />
                <div className="ac-sign-line" />
                <span>Class Teacher</span>
              </div>
              {qrDataUrl && <img src={qrDataUrl} alt="" className="ac-qr" />}
              <div className="ac-sign">
                <SignatureScribble />
                <div className="ac-sign-line" />
                <span>Head Teacher</span>
              </div>
            </div>

            <div className="ac-footer">
              <span className="ac-footer-line" />
              Knowledge is Power
              <span className="ac-footer-line" />
            </div>
            </div>

            <div className="ac-notes">
              <p className="ac-notes-title">Important Notes</p>
              <ol>
                {ADMIT_CARD_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ol>
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
