import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/dashboard-ui";
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
  { range: "80-100", grade: "A+", gpa: "5.0" },
  { range: "70-79", grade: "A", gpa: "4.0" },
  { range: "60-69", grade: "A-", gpa: "3.5" },
  { range: "50-59", grade: "B", gpa: "3.0" },
  { range: "40-49", grade: "C", gpa: "2.0" },
  { range: "33-39", grade: "D", gpa: "1.0" },
  { range: "0-32", grade: "F", gpa: "0.0" },
];

const GRADE_BADGE_TONE: Record<string, string> = {
  "A+": "green",
  A: "teal",
  "A-": "purple",
  B: "amber",
  C: "amber",
  D: "red",
  F: "red",
};

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

// Display-only, derived from the overall grade/GPA — not stored anywhere.
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

  const data = report.data;
  const passed = data ? data.letterGrade !== "F" : false;
  const attendancePct =
    data && data.totalWorkingDays && data.totalWorkingDays > 0
      ? Math.round(((data.totalAttendances ?? 0) / data.totalWorkingDays) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent style={{ maxWidth: 960 }}>
        {report.isLoading && <p>Loading…</p>}
        {report.error && (
          <p style={{ color: "var(--red)" }}>
            {report.error instanceof ApiError ? report.error.message : "Couldn't load progress report"}
          </p>
        )}
        {data && (
          <>
            <div className="progress-report">
              <div className="pr-header">
                <img src={SCHOOL_LOGO} alt="" className="pr-logo" />
                <div className="pr-header-text">
                  <div className="pr-header-title-row">
                    <h2>{SCHOOL_NAME}</h2>
                    <Badge tone="green">Official Marksheet</Badge>
                  </div>
                  <p>
                    {profile.data?.address && `${profile.data.address} • `}
                    {data.examTitle}
                  </p>
                </div>
                <span className="pr-chip">
                  Class: {data.className} • Roll: {data.roll}
                </span>
              </div>

              <div className="pr-top-grid">
                <div className="pr-info-card">
                  <p className="pr-section-label">Student Information</p>
                  <div className="pr-info-grid">
                    <div>
                      <span className="pr-info-label">Student Name</span>
                      <strong>{data.studentName}</strong>
                    </div>
                    <div>
                      <span className="pr-info-label">Class &amp; Roll</span>
                      <strong>
                        {data.className} (Roll: {String(data.roll).padStart(2, "0")})
                      </strong>
                    </div>
                    <div>
                      <span className="pr-info-label">Academic Term</span>
                      <strong>{data.examTitle}</strong>
                    </div>
                    <div>
                      <span className="pr-info-label">Working Days / Present</span>
                      <strong>
                        {data.totalWorkingDays ?? "—"} / {data.totalAttendances ?? "—"} Days
                        {attendancePct !== null && <span className="pr-muted"> ({attendancePct}%)</span>}
                      </strong>
                    </div>
                    <div>
                      <span className="pr-info-label">Result Status</span>
                      <strong className={passed ? "pr-pass" : "pr-fail"}>
                        {resultStatus(data.letterGrade, data.gpa)}
                      </strong>
                    </div>
                    <div>
                      <span className="pr-info-label">Teacher&rsquo;s Remarks</span>
                      <Badge tone="green">{remarkForGpa(data.gpa)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="pr-stat-card pr-stat-green">
                  <div className="pr-stat-top">
                    <span>Grade Point</span>
                    <Badge tone={passed ? "green" : "red"}>{passed ? "Passed" : "Failed"}</Badge>
                  </div>
                  <div className="pr-stat-value">
                    {data.gpa.toFixed(2)}
                    <span>/5.00</span>
                  </div>
                  <p>Letter Grade: {data.letterGrade}</p>
                </div>

                <div className="pr-stat-card pr-stat-orange">
                  <div className="pr-stat-top">
                    <span>Merit Position</span> ★
                  </div>
                  <div className="pr-stat-value">
                    {ordinal(data.position)}
                    <span>Position</span>
                  </div>
                  <p>
                    {data.position === 1
                      ? `Top of ${data.className}`
                      : `Out of ${data.totalStudents} in ${data.className}`}
                  </p>
                </div>
              </div>

              <div className="pr-table-card">
                <div className="pr-table-header">
                  <p className="pr-section-label">Subject Breakdown &amp; Evaluation</p>
                  <div className="pr-legend">
                    <span className="pr-legend-chip">T1 = Tutorial 1 • T2 = Tutorial 2</span>
                    <span className="pr-legend-label">Grading scale:</span>
                    {GRADE_SCALE.map((g) => (
                      <span className="pr-legend-chip" key={g.grade}>
                        {g.range}: <strong>{g.grade}</strong> ({g.gpa})
                      </span>
                    ))}
                  </div>
                </div>
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th>Subject Name</th>
                      <th>Full Marks</th>
                      <th>T1</th>
                      <th>T2</th>
                      <th>1st Semester</th>
                      <th>Total Marks</th>
                      <th>Highest</th>
                      <th>Grade Point</th>
                      <th>Letter Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((s) => (
                      <tr key={s.subjectId}>
                        <td>{s.subjectName}</td>
                        <td className="mono">{s.fullMarks}</td>
                        <td className="mono">{s.ct1Marks ?? "—"}</td>
                        <td className="mono">{s.ct2Marks ?? "—"}</td>
                        <td className="mono">{s.semesterFinalMarks ?? "—"}</td>
                        <td className="mono strong pr-total-cell">{s.totalMarks}</td>
                        <td className="mono pr-muted">{s.highestMarks}</td>
                        <td className="mono strong">{s.gradePoint.toFixed(2)}</td>
                        <td>
                          <Badge tone={GRADE_BADGE_TONE[s.letterGrade] ?? "neutral"}>{s.letterGrade}</Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="pr-total-row">
                      <th>Grand Total Summary</th>
                      <td className="mono strong">{data.totalFullMarks}</td>
                      <td />
                      <td />
                      <td className="pr-total-label">Total Obtained Marks:</td>
                      <td className="mono strong pr-total-cell">{data.totalObtained}</td>
                      <td className="pr-total-label">Overall Term GPA:</td>
                      <td className="mono strong pr-total-cell" colSpan={2}>
                        {data.gpa.toFixed(2)} ({data.letterGrade})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pr-signatures">
                <div className="pr-sig">
                  <div className="pr-sig-line" />
                  <span>Class Teacher&rsquo;s Signature</span>
                </div>
                <div className="pr-sig">
                  <div className="pr-sig-line" />
                  <span>Guardian&rsquo;s Signature</span>
                </div>
                <div className="pr-sig">
                  <div className="pr-sig-line" />
                  <span>Principal&rsquo;s Signature</span>
                </div>
              </div>

              <div className="pr-footer">
                {/* Only reachable once the exam is published (gated by the caller). */}
                <span className="pr-status-dot" />
                Status: <strong>Published &amp; Verified</strong>
                <span className="pr-muted"> | {SCHOOL_NAME} SMS</span>
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
