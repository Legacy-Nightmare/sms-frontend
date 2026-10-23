import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { fetchSemesterResult } from "@/lib/exams-api";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { ApiError } from "@/lib/api";

export function StudentMarksheetDialog({
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

  const result = useQuery({
    queryKey: ["semester-result", classId, studentId, academicYear],
    queryFn: () => fetchSemesterResult(classId, studentId, academicYear),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="print-dialog" style={{ maxWidth: 640 }}>
        {result.isLoading && <p>Loading…</p>}
        {result.error && (
          <p style={{ color: "var(--red)" }}>
            {result.error instanceof ApiError ? result.error.message : "Couldn't load marksheet"}
          </p>
        )}
        {result.data && (
          <>
            <div className="print-area">
              <div className="print-letterhead">
                <img src={SCHOOL_LOGO} alt="" />
                <div>
                  <h2>{SCHOOL_NAME}</h2>
                  <p>Academic Marksheet — {result.data.academicYear}</p>
                </div>
              </div>

              <table className="print-doc-table" style={{ marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <th style={{ width: "30%" }}>Student</th>
                    <td>
                      {result.data.studentName} ({result.data.studentCode})
                    </td>
                  </tr>
                  <tr>
                    <th>Contributing exams</th>
                    <td>
                      {result.data.tutorialExam?.name ?? "— (no tutorial exam)"} +{" "}
                      {result.data.finalExam?.name ?? "— (no final exam)"}{" "}
                      <span className="muted-cell">
                        (weighted {result.data.tutorialWeightPercent}% /{" "}
                        {result.data.finalWeightPercent}%)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="print-doc-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Tutorial</th>
                    <th>Final</th>
                    <th>Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.subjects.map((s) => (
                    <tr key={s.subjectId}>
                      <td>{s.subjectName}</td>
                      <td className="mono">{s.tutorialMarks ?? "—"}</td>
                      <td className="mono">{s.finalMarks ?? "—"}</td>
                      <td className="mono">
                        {s.combinedMarks} / {s.fullMarks}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th>Total</th>
                    <td />
                    <td />
                    <td className="mono strong">
                      {result.data.totalObtained} / {result.data.totalFullMarks} (
                      {result.data.percentage}%)
                    </td>
                  </tr>
                  <tr>
                    <th>Grade</th>
                    <td colSpan={3} className="strong">
                      {result.data.grade} · GPA {result.data.gpa.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="drawer-actions">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
              <Button type="button" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
