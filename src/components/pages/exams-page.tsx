import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileClock,
  Globe,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { AddSubjectDialog } from "@/components/add-subject-dialog";
import { StudentAvatar } from "@/components/student-avatar";
import { StudentMarksheetDialog } from "@/components/student-marksheet-dialog";
import { fetchClasses, fetchSections } from "@/lib/academics-api";
import {
  announceExamResults,
  createExam,
  deleteExam,
  enterMarks,
  fetchExamResults,
  fetchExams,
  fetchMarksSheet,
  fetchSubjects,
  notifyGuardians,
  publishAndNotifyGuardians,
  publishExam,
  retractResultsAnnouncement,
  updateExam,
  type ExamDto,
  type ExamType,
  type MarkValidationError,
  type MissingGuardianEmail,
} from "@/lib/exams-api";
import { ApiError } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";

function CreateExamDialog() {
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ExamType>("final");
  const [classId, setClassId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createExam({
        name,
        type,
        classId: parseInt(classId, 10),
        examDate: examDate || undefined,
        academicYear: academicYear || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success(`${name} created`);
      setOpen(false);
      setName("");
      setType("final");
      setClassId("");
      setExamDate("");
      setAcademicYear("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't create exam"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create exam
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create exam</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Exam name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Midterm 2026"
            />
          </label>
          <div className="two-fields">
            <label>
              Class
              <select required value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="" disabled>
                  Select class
                </option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    Class {c.level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </label>
          </div>
          <div className="two-fields">
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                <option value="final">Final</option>
                <option value="tutorial">Tutorial</option>
              </select>
            </label>
            <label>
              Academic year <span className="muted-cell">(needed to combine tutorial + final)</span>
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026"
              />
            </label>
          </div>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Create exam"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Class is deliberately not editable here (the backend rejects it too) —
// moving an exam to a different class after marks exist would orphan them.
function EditExamDialog({
  exam,
  onOpenChange,
}: {
  exam: ExamDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<ExamType>("final");
  const [examDate, setExamDate] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  useEffect(() => {
    if (exam) {
      setName(exam.name);
      setType(exam.type);
      setExamDate(exam.examDate ?? "");
      setAcademicYear(exam.academicYear ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!exam) throw new Error("No exam selected");
      return updateExam(exam.id, {
        name,
        type,
        examDate: examDate || undefined,
        academicYear: academicYear || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam updated");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update exam"),
  });

  return (
    <Dialog open={!!exam} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit exam</DialogTitle>
        </DialogHeader>
        {exam && (
          <form
            className="student-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              Exam name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="two-fields">
              <label>
                Class <span className="muted-cell">(not editable)</span>
                <input value={exam.classEntity.name} disabled />
              </label>
              <label>
                Date
                <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </label>
            </div>
            <div className="two-fields">
              <label>
                Type
                <select value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                  <option value="final">Final</option>
                  <option value="tutorial">Tutorial</option>
                </select>
              </label>
              <label>
                Academic year
                <input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026"
                />
              </label>
            </div>
            <div className="drawer-actions">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteExamDialog({
  exam,
  onOpenChange,
  onDeleted,
}: {
  exam: ExamDto | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (examId: number) => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (examId: number) => deleteExam(examId),
    onSuccess: (_result, examId) => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam deleted");
      onDeleted(examId);
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete exam"),
  });

  return (
    <Dialog open={!!exam} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Delete {exam?.name}?</DialogTitle>
        </DialogHeader>
        <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
          This permanently removes &quot;{exam?.name}&quot; and all marks entered for it. This
          cannot be undone.
        </p>
        <div className="drawer-actions">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => exam && remove.mutate(exam.id)}
          >
            {remove.isPending ? "Deleting…" : "Delete exam"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The bulk-entry grid for one exam + subject: every student in the class
// (optionally narrowed to one section) as a row, marks as a single editable
// cell per row. This is the "efficient, not one student at a time" flow —
// pick a subject once, then move down the roster.
function MarksEntryGrid({
  examId,
  classId,
  classLevel,
}: {
  examId: number;
  classId: number;
  classLevel: number;
}) {
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const subjects = useQuery({
    queryKey: ["subjects", classId],
    queryFn: () => fetchSubjects(classId),
  });
  const sections = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => fetchSections(classId),
  });

  useEffect(() => {
    if (subjectId === "" && subjects.data?.[0]) {
      setSubjectId(subjects.data[0].id);
    }
  }, [subjects.data, subjectId]);

  const sheet = useQuery({
    queryKey: ["marks-sheet", examId, subjectId, sectionId],
    queryFn: () =>
      fetchMarksSheet(examId, subjectId as number, sectionId === "" ? undefined : sectionId),
    enabled: subjectId !== "",
  });

  const selectedSubject = subjects.data?.find((s) => s.id === subjectId);

  // Re-seed the editable values whenever a fresh sheet arrives for a
  // (possibly new) subject/section — never while the same sheet is just
  // being re-rendered, so in-progress edits aren't clobbered.
  useEffect(() => {
    if (!sheet.data) return;
    setValues(
      Object.fromEntries(
        sheet.data.map((r) => [
          r.studentId,
          r.marksObtained === null ? "" : String(r.marksObtained),
        ]),
      ),
    );
    setRowErrors({});
  }, [sheet.data]);

  const isDirty = useMemo(() => {
    if (!sheet.data) return false;
    return sheet.data.some((r) => {
      const original = r.marksObtained === null ? "" : String(r.marksObtained);
      return (values[r.studentId] ?? "") !== original;
    });
  }, [sheet.data, values]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const confirmDiscardIfDirty = () =>
    !isDirty || window.confirm("You have unsaved marks. Discard them?");

  const save = useMutation({
    mutationFn: () => {
      const entries = Object.entries(values)
        .filter(([, v]) => v !== "")
        .map(([studentId, v]) => ({
          studentId: Number(studentId),
          subjectId: subjectId as number,
          marksObtained: Number(v),
        }));
      return enterMarks(examId, entries);
    },
    onSuccess: (res) => {
      setRowErrors({});
      queryClient.invalidateQueries({ queryKey: ["marks-sheet", examId, subjectId, sectionId] });
      queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
      toast.success(`Saved ${res.saved} mark${res.saved === 1 ? "" : "s"}`);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.details &&
        typeof error.details === "object" &&
        "errors" in error.details
      ) {
        const errors = (error.details as { errors: MarkValidationError[] }).errors;
        setRowErrors(Object.fromEntries(errors.map((e) => [e.studentId, e.message])));
        toast.error(
          `${errors.length} row${errors.length === 1 ? "" : "s"} couldn't be saved — see highlighted rows`,
        );
      } else {
        toast.error(error instanceof ApiError ? error.message : "Couldn't save marks");
      }
    },
  });

  const focusRow = (studentId: number, offset: number) => {
    if (!sheet.data) return;
    const index = sheet.data.findIndex((r) => r.studentId === studentId);
    const target = sheet.data[index + offset];
    if (target) inputRefs.current[target.studentId]?.focus();
  };

  const onKeyDown = (studentId: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(studentId, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(studentId, -1);
    }
  };

  return (
    <Panel>
      <div className="panel-title">
        <h2>Enter marks</h2>
        {isDirty && <Badge tone="amber">Unsaved changes</Badge>}
      </div>
      <div
        style={{
          padding: "16px 17px 0",
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <label style={{ minWidth: 220 }}>
          Subject
          <select
            value={subjectId}
            onChange={(e) => {
              if (!confirmDiscardIfDirty()) return;
              setSubjectId(e.target.value ? parseInt(e.target.value, 10) : "");
            }}
          >
            <option value="" disabled>
              Select subject
            </option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (/{s.fullMarks})
              </option>
            ))}
          </select>
        </label>
        {sections.data && sections.data.length > 1 && (
          <label style={{ minWidth: 180 }}>
            Section
            <select
              value={sectionId}
              onChange={(e) => {
                if (!confirmDiscardIfDirty()) return;
                setSectionId(e.target.value ? parseInt(e.target.value, 10) : "");
              }}
            >
              <option value="">All sections</option>
              {sections.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <AddSubjectDialog classId={classId} classLevel={classLevel} />
      </div>

      {subjects.data?.length === 0 && (
        <p style={{ padding: "12px 17px 0", color: "var(--muted-foreground)", fontSize: 12 }}>
          No subjects defined for this class yet — add one above before entering marks.
        </p>
      )}

      {subjectId !== "" && (
        <DataTable
          headers={["ROLL", "STUDENT", "CODE", `MARKS (/${selectedSubject?.fullMarks ?? 100})`]}
          widths=".5fr 1.6fr 1fr 1fr"
        >
          {sheet.isLoading && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
          {sheet.data?.length === 0 && (
            <EmptyRow colSpan={4}>No students in this class/section</EmptyRow>
          )}
          {sheet.data?.map((row) => (
            <tr key={row.studentId}>
              <td className="mono muted-cell">{row.roll}</td>
              <td>{row.studentName}</td>
              <td className="mono muted-cell">{row.studentCode}</td>
              <td>
                <input
                  ref={(el) => {
                    inputRefs.current[row.studentId] = el;
                  }}
                  type="number"
                  min={0}
                  max={selectedSubject?.fullMarks}
                  value={values[row.studentId] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [row.studentId]: e.target.value }))
                  }
                  onKeyDown={onKeyDown(row.studentId)}
                  style={{
                    width: 90,
                    borderColor: rowErrors[row.studentId] ? "var(--red)" : undefined,
                  }}
                  title={rowErrors[row.studentId]}
                />
                {rowErrors[row.studentId] && (
                  <div style={{ color: "var(--red)", fontSize: 11, marginTop: 4 }}>
                    {rowErrors[row.studentId]}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <div className="results-footer">
        <div />
        <Button disabled={save.isPending || subjectId === ""} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save marks"}
        </Button>
      </div>
    </Panel>
  );
}

export function ExamsPage() {
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "draft" | "published">("");
  const [editingExam, setEditingExam] = useState<ExamDto | null>(null);
  const [deletingExam, setDeletingExam] = useState<ExamDto | null>(null);

  const exams = useQuery({ queryKey: ["exams"], queryFn: () => fetchExams() });
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const selectedExam = exams.data?.find((e) => e.id === selectedExamId) ?? null;

  useEffect(() => {
    const first = exams.data?.[0];
    if (selectedExamId === null && first) {
      setSelectedExamId(first.id);
    }
  }, [exams.data, selectedExamId]);

  const examResults = useQuery({
    queryKey: ["exam-results", selectedExamId],
    queryFn: () => fetchExamResults(selectedExamId!),
    enabled: !!selectedExamId,
  });

  // Fetched (not just the subject dropdown's own copy inside MarksEntryGrid)
  // so we can tell whether every subject has been scored for every student
  // before letting the exam be published.
  const classSubjects = useQuery({
    queryKey: ["subjects", selectedExam?.classId],
    queryFn: () => fetchSubjects(selectedExam!.classId),
    enabled: !!selectedExam,
  });

  const totalSubjects = classSubjects.data?.length ?? 0;
  const totalStudents = examResults.data?.length ?? 0;
  const studentsComplete =
    examResults.data?.filter((r) => r.subjects.length === totalSubjects).length ?? 0;
  const marksComplete =
    totalSubjects > 0 && totalStudents > 0 && studentsComplete === totalStudents;

  const invalidateAfterPublishAction = (examId: number) => {
    queryClient.invalidateQueries({ queryKey: ["exams"] });
    queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const warnIfGuardiansMissing = (missing: MissingGuardianEmail[]) => {
    if (missing.length === 0) return;
    toast.warning(
      `${missing.length} student(s) have no guardian email on file: ` +
        missing.map((s) => `${s.studentName} (${s.studentCode})`).join(", "),
    );
  };

  const publishOnly = useMutation({
    mutationFn: (examId: number) => publishExam(examId),
    onSuccess: (res, examId) => {
      invalidateAfterPublishAction(examId);
      toast.success(`Exam published (${res.published} result${res.published === 1 ? "" : "s"})`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't publish exam"),
  });

  const notify = useMutation({
    mutationFn: (examId: number) => notifyGuardians(examId),
    onSuccess: (res, examId) => {
      invalidateAfterPublishAction(examId);
      toast.success(`Emailed ${res.emailed} guardian(s)`);
      warnIfGuardiansMissing(res.missingGuardianEmail);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't email guardians"),
  });

  const publishAndNotify = useMutation({
    mutationFn: (examId: number) => publishAndNotifyGuardians(examId),
    onSuccess: (res, examId) => {
      invalidateAfterPublishAction(examId);
      toast.success(`Published and emailed ${res.emailed} guardian(s)`);
      warnIfGuardiansMissing(res.missingGuardianEmail);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't publish exam"),
  });

  // Announcement-only on the public website — no marks are ever exposed,
  // just "Result Published — Class X, Exam Name". Requires the exam to
  // already be published (enforced server-side too).
  const announceResults = useMutation({
    mutationFn: (examId: number) => announceExamResults(examId),
    onSuccess: (_result, examId) => {
      invalidateAfterPublishAction(examId);
      toast.success("Results announced on the website");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't announce results"),
  });

  const retractAnnouncement = useMutation({
    mutationFn: (examId: number) => retractResultsAnnouncement(examId),
    onSuccess: (_result, examId) => {
      invalidateAfterPublishAction(examId);
      toast.success("Announcement removed from the website");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove announcement"),
  });

  // Publishing/notifying lives only in the exam row's "⋯" menu, never as a
  // button on the marks-entry screen itself — so completeness is checked on
  // demand here (the entry screen's own query only covers the selected exam)
  // before any of the three actions is allowed to run.
  const verifyMarksComplete = async (exam: ExamDto): Promise<boolean> => {
    try {
      const [results, subjects] = await Promise.all([
        fetchExamResults(exam.id),
        fetchSubjects(exam.classId),
      ]);
      const total = subjects.length;
      const doneCount = results.filter((r) => r.subjects.length === total).length;
      if (total === 0) {
        toast.error("Add subjects to this class before publishing");
        return false;
      }
      if (doneCount < results.length) {
        toast.error(
          `Only ${doneCount}/${results.length} students have marks for all ${total} subject${total === 1 ? "" : "s"} — finish entering marks first`,
        );
        return false;
      }
      return true;
    } catch {
      toast.error("Couldn't check marks before publishing");
      return false;
    }
  };

  const totalExams = exams.data?.length ?? 0;
  const draftCount = exams.data?.filter((e) => !e.publishedAt).length ?? 0;
  const publishedCount = exams.data?.filter((e) => e.publishedAt).length ?? 0;
  const guardiansNotified = exams.data?.reduce((sum, e) => sum + e.emailedCount, 0) ?? 0;

  const filteredExams = (exams.data ?? []).filter((exam: ExamDto) => {
    if (search && !exam.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClassId !== "" && exam.classId !== filterClassId) return false;
    if (filterStatus === "draft" && exam.publishedAt) return false;
    if (filterStatus === "published" && !exam.publishedAt) return false;
    return true;
  });

  const downloadResultsReport = () => {
    if (!selectedExam || !examResults.data) return;
    downloadCsv(
      `${selectedExam.classEntity.name}-${selectedExam.name}-results.csv`.replace(/\s+/g, "-"),
      ["Student", "Code", "Total", "Full marks", "Percentage", "Grade", "GPA"],
      examResults.data.map((r) => [
        r.studentName,
        r.studentCode,
        r.totalObtained,
        r.totalFullMarks,
        r.percentage,
        r.grade,
        r.gpa.toFixed(2),
      ]),
    );
  };

  return (
    <>
      <PageHeading
        title="Exams & results"
        subtitle="Manage exams, enter marks, publish results and notify guardians"
        action={<CreateExamDialog />}
      />

      <div className="stat-grid">
        <Panel className="stat stat-mint">
          <div className="stat-top">
            <span className="stat-icon stat-icon-teal">
              <ClipboardList />
            </span>
          </div>
          <strong>{totalExams}</strong>
          <span>Total exams</span>
          <small>All exams in this session</small>
        </Panel>
        <Panel className="stat stat-orange">
          <div className="stat-top">
            <span className="stat-icon stat-icon-orange">
              <FileClock />
            </span>
          </div>
          <strong>{draftCount}</strong>
          <span>Draft results</span>
          <small>Results awaiting publication</small>
        </Panel>
        <Panel className="stat stat-green">
          <div className="stat-top">
            <span className="stat-icon stat-icon-green">
              <CheckCircle2 />
            </span>
          </div>
          <strong>{publishedCount}</strong>
          <span>Published</span>
          <small>Results published</small>
        </Panel>
        <Panel className="stat stat-blue">
          <div className="stat-top">
            <span className="stat-icon stat-icon-blue">
              <Mail />
            </span>
          </div>
          <strong>{guardiansNotified}</strong>
          <span>Guardians notified</span>
          <small>Emails sent to guardians</small>
        </Panel>
      </div>

      <Panel className="exam-list">
        <div className="panel-title">
          <h2>Exams</h2>
        </div>
        <div className="exam-filters">
          <div className="search-input">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams…"
            />
          </div>
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value ? parseInt(e.target.value, 10) : "")}
          >
            <option value="">All classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.level}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | "draft" | "published")}
          >
            <option value="">All status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <DataTable
          headers={["EXAM", "TYPE", "CLASS", "EXAM DATE", "STATUS", "ACTIONS"]}
          widths="1.3fr .7fr .85fr 1.1fr 1.05fr 1.5fr"
        >
          {exams.isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
          {!exams.isLoading && filteredExams.length === 0 && (
            <EmptyRow colSpan={6}>
              {exams.data?.length === 0
                ? "No exams yet — create one."
                : "No exams match your filters."}
            </EmptyRow>
          )}
          {filteredExams.map((exam) => (
            <tr
              key={exam.id}
              onClick={() => setSelectedExamId(exam.id)}
              style={{
                cursor: "pointer",
                background: exam.id === selectedExamId ? "var(--row-active)" : undefined,
              }}
            >
              <td>{exam.name}</td>
              <td>
                <Badge tone={exam.type === "tutorial" ? "amber" : "teal"}>
                  {exam.type === "tutorial" ? "Tutorial" : "Final"}
                </Badge>
              </td>
              <td>{exam.classEntity.name}</td>
              <td className="mono strong">{exam.examDate ?? "—"}</td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {exam.publishedAt ? (
                    <Badge tone="green">Published</Badge>
                  ) : (
                    <Badge tone="amber">Draft</Badge>
                  )}
                  {exam.resultsAnnouncedAt && <Badge tone="teal">On site</Badge>}
                </div>
              </td>
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => setSelectedExamId(exam.id)}>
                  {exam.publishedAt ? "View results" : "Enter marks"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="More actions">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingExam(exam)}>
                      <Pencil size={14} />
                      Edit exam
                    </DropdownMenuItem>
                    {!exam.publishedAt && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            if (await verifyMarksComplete(exam)) publishOnly.mutate(exam.id);
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Publish
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            if (await verifyMarksComplete(exam)) notify.mutate(exam.id);
                          }}
                        >
                          <Mail size={14} />
                          Send email to guardians
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            if (await verifyMarksComplete(exam)) publishAndNotify.mutate(exam.id);
                          }}
                        >
                          <Send size={14} />
                          Publish &amp; send to guardians
                        </DropdownMenuItem>
                      </>
                    )}
                    {exam.publishedAt && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            if (await verifyMarksComplete(exam)) notify.mutate(exam.id);
                          }}
                        >
                          <Mail size={14} />
                          Send email to guardians
                        </DropdownMenuItem>
                        {exam.resultsAnnouncedAt ? (
                          <DropdownMenuItem onClick={() => retractAnnouncement.mutate(exam.id)}>
                            <Globe size={14} />
                            Remove website announcement
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => announceResults.mutate(exam.id)}>
                            <Globe size={14} />
                            Announce results on website
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuItem className="danger-item" onClick={() => setDeletingExam(exam)}>
                      <Trash2 size={14} />
                      Delete exam
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {selectedExam && selectedExam.publishedAt && (
        <Panel>
          <div className="panel-title">
            <h2>
              Published results · {selectedExam.classEntity.name} · {selectedExam.name}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge tone="green">Published</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={notify.isPending}
                onClick={async () => {
                  if (await verifyMarksComplete(selectedExam)) notify.mutate(selectedExam.id);
                }}
              >
                <Send size={14} />
                {notify.isPending ? "Sending…" : "Send to guardians"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!examResults.data}
                onClick={downloadResultsReport}
              >
                <Download size={14} />
                Download report
              </Button>
            </div>
          </div>
          <DataTable
            headers={[
              "STUDENT",
              "TOTAL MARKS",
              "PERCENTAGE",
              "GRADE",
              "GUARDIAN NOTIFICATION",
              "ACTION",
            ]}
            widths="1.6fr 1fr .9fr 1.2fr 1.3fr 1.1fr"
          >
            {examResults.isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
            {examResults.data?.map((r) => (
              <tr key={r.studentId}>
                <td>
                  <StudentAvatar name={r.studentName} photoUrl={null} />
                  {r.studentName} <span className="muted-cell mono">({r.studentCode})</span>
                </td>
                <td className="mono">
                  {r.totalObtained} / {r.totalFullMarks}
                </td>
                <td className="mono">{r.percentage}%</td>
                <td>
                  <Badge tone="amber">
                    {r.grade} · GPA {r.gpa.toFixed(2)}
                  </Badge>
                </td>
                <td>
                  <span
                    className={`status-dot ${r.hasGuardianEmail ? "status-dot-green" : "status-dot-amber"}`}
                  />
                  {r.hasGuardianEmail ? "Sent" : "Pending"}
                </td>
                <td>
                  {selectedExam.academicYear ? (
                    <StudentMarksheetDialog
                      classId={selectedExam.classId}
                      studentId={r.studentId}
                      academicYear={selectedExam.academicYear}
                      trigger={
                        <Button size="sm" variant="outline">
                          Marksheet
                        </Button>
                      }
                    />
                  ) : (
                    <span
                      className="muted-cell"
                      title="Set an academic year on this exam to view a marksheet"
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      )}

      {selectedExam && !selectedExam.publishedAt && (
        <>
          <MarksEntryGrid
            examId={selectedExam.id}
            classId={selectedExam.classId}
            classLevel={selectedExam.classEntity.level}
          />
          <div className="results-footer">
            <div>
              {totalSubjects === 0 && (
                <span className="muted-cell" style={{ fontSize: 12 }}>
                  Add a subject above before marks can be entered
                </span>
              )}
              {totalSubjects > 0 && !marksComplete && (
                <span className="muted-cell" style={{ fontSize: 12 }}>
                  {studentsComplete}/{totalStudents} students fully scored across {totalSubjects}{" "}
                  subject{totalSubjects === 1 ? "" : "s"} — finish every subject for every student,
                  then publish from the exam's ⋯ menu above
                </span>
              )}
              {totalSubjects > 0 && marksComplete && (
                <span style={{ fontSize: 12, color: "var(--green)" }}>
                  All marks entered — publish this exam from its ⋯ menu above
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <EditExamDialog exam={editingExam} onOpenChange={(open) => !open && setEditingExam(null)} />
      <DeleteExamDialog
        exam={deletingExam}
        onOpenChange={(open) => !open && setDeletingExam(null)}
        onDeleted={(examId) => {
          if (selectedExamId === examId) setSelectedExamId(null);
        }}
      />
    </>
  );
}
