import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { fetchProgressReport } from "@/lib/exams-api";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { fetchSchoolProfile } from "@/lib/website-api";
import { downloadProgressReportPdf } from "@/lib/progress-report-pdf";
import { ApiError } from "@/lib/api";

// Mirrors the Bangladesh NCTB scale in backend/src/exams/grading.ts exactly
// — shown as the small reference legend real report cards print, not a
// second source of truth (the actual per-subject grades come from the
// fetched report, already computed server-side with this same scale).
const GRADE_SCALE = [
  { range: "80-100", grade: "A+", gpa: "5.00" },
  { range: "70-79", grade: "A", gpa: "4.00" },
  { range: "60-69", grade: "A-", gpa: "3.50" },
  { range: "50-59", grade: "B", gpa: "3.00" },
  { range: "40-49", grade: "C", gpa: "2.00" },
  { range: "33-39", grade: "D", gpa: "1.00" },
  { range: "0-32", grade: "F", gpa: "0.00" },
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

// A simple, display-only remark derived from the overall GPA — not stored
// anywhere, just a reasonable default the printed card always shows one of.
function remarkForGpa(gpa: number): string {
  if (gpa >= 4.5) return "Excellent";
  if (gpa >= 3.5) return "Very Good";
  if (gpa >= 3.0) return "Good";
  if (gpa >= 2.0) return "Average";
  return "Needs Improvement";
}

export function ProgressReportDialog({
  classId,
  studentId,
  academicYear,
  trigger,
}: {
  classId: number;
  studentId: number;
  academicYear: string;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const report = useQuery({
    queryKey: ["progress-report", classId, studentId, academicYear],
    queryFn: () => fetchProgressReport(classId, studentId, academicYear),
    enabled: open,
  });
  const profile = useQuery({ queryKey: ["school-profile"], queryFn: fetchSchoolProfile, enabled: open });

  const handleDownload = async () => {
    if (!report.data) return;
    setDownloading(true);
    try {
      await downloadProgressReportPdf(report.data, profile.data?.address ?? null);
    } catch {
      toast.error("Couldn't generate the progress report PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="print-dialog" style={{ maxWidth: 760 }}>
        {report.isLoading && <p>Loading…</p>}
        {report.error && (
          <p style={{ color: "var(--red)" }}>
            {report.error instanceof ApiError ? report.error.message : "Couldn't load progress report"}
          </p>
        )}
        {report.data && (
          <>
            <div className="print-area">
              <div className="print-letterhead" style={{ justifyContent: "center", textAlign: "center" }}>
                <img src={SCHOOL_LOGO} alt="" />
                <div>
                  <h2>{SCHOOL_NAME}</h2>
                  {profile.data?.address && <p>{profile.data.address}</p>}
                  <p style={{ fontWeight: 600 }}>{report.data.examTitle}</p>
                </div>
              </div>

              <h3 style={{ textAlign: "center", border: "1px solid var(--foreground)", display: "inline-block", padding: "4px 24px", margin: "0 auto 14px", fontSize: 15 }}>
                Progress Report
              </h3>

              <table className="print-doc-table" style={{ marginBottom: 10 }}>
                <tbody>
                  <tr>
                    <th style={{ width: "20%" }}>Student&rsquo;s Name</th>
                    <td>{report.data.studentName}</td>
                    <th style={{ width: "15%" }}>Class</th>
                    <td>{report.data.className}</td>
                    <th style={{ width: "15%" }}>Roll No</th>
                    <td className="mono">{report.data.roll}</td>
                  </tr>
                </tbody>
              </table>

              <table className="print-doc-table" style={{ marginBottom: 14, fontSize: 11, maxWidth: 320, marginLeft: "auto" }}>
                <thead>
                  <tr>
                    <th>Mark</th>
                    <th>Grade</th>
                    <th>GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {GRADE_SCALE.map((g) => (
                    <tr key={g.grade}>
                      <td className="mono">{g.range}</td>
                      <td>{g.grade}</td>
                      <td className="mono">{g.gpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="print-doc-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Full Marks</th>
                    <th>T1</th>
                    <th>T2</th>
                    <th>1st Semester Total Marks</th>
                    <th>Highest Marks</th>
                    <th>Grade Point</th>
                    <th>Letter Grade</th>
                    <th>GPA</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.subjects.map((s, i) => (
                    <tr key={s.subjectId}>
                      <td>{s.subjectName}</td>
                      <td className="mono">{s.fullMarks}</td>
                      <td className="mono">{s.ct1Marks ?? "—"}</td>
                      <td className="mono">{s.ct2Marks ?? "—"}</td>
                      <td className="mono strong">{s.totalMarks}</td>
                      <td className="mono">{s.highestMarks}</td>
                      <td className="mono">{s.gradePoint.toFixed(2)}</td>
                      <td>{s.letterGrade}</td>
                      {i === 0 && (
                        <td className="mono strong" rowSpan={report.data.subjects.length}>
                          {report.data.gpa.toFixed(2)}
                        </td>
                      )}
                      {i === 0 && (
                        <td className="strong" rowSpan={report.data.subjects.length}>
                          {ordinal(report.data.position)}
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <th>Total Marks</th>
                    <td className="mono strong">{report.data.totalFullMarks}</td>
                    <td />
                    <td />
                    <td className="mono strong">{report.data.totalObtained}</td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>

              <table className="print-doc-table" style={{ marginTop: 14 }}>
                <tbody>
                  <tr>
                    <th style={{ width: "25%" }}>Total Working Days</th>
                    <td className="mono">{report.data.totalWorkingDays ?? "—"}</td>
                    <th style={{ width: "25%" }}>Total Attendances</th>
                    <td className="mono">{report.data.totalAttendances ?? "—"}</td>
                  </tr>
                  <tr>
                    <th>Remarks</th>
                    <td colSpan={3}>{remarkForGpa(report.data.gpa)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="admit-card-signatures" style={{ marginTop: 50 }}>
                <div>
                  <div className="admit-card-signature-line" />
                  Class Teacher&rsquo;s Signature
                </div>
                <div>
                  <div className="admit-card-signature-line" />
                  Guardian&rsquo;s Signature
                </div>
                <div>
                  <div className="admit-card-signature-line" />
                  Principal&rsquo;s Signature
                  <p style={{ margin: "4px 0 0", fontSize: 11 }}>G.P.A: {report.data.gpa.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="drawer-actions">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
              <Button type="button" onClick={handleDownload} disabled={downloading}>
                <Download size={14} />
                {downloading ? "Preparing…" : "Download PDF"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
