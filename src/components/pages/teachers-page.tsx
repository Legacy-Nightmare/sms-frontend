import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { ApiError } from "@/lib/api";
import {
  createTeacher,
  deleteTeacher,
  fetchTeachers,
  setTeacherAssignments,
  teacherPhotoUrl,
  updateTeacher,
  uploadTeacherPhoto,
  type TeacherDto,
} from "@/lib/teachers-api";
import { fetchAllClassSubjects, type ClassSubjectDto } from "@/lib/exams-api";
import { fetchSubjectCatalog } from "@/lib/subjects-catalog-api";
import { fetchClasses } from "@/lib/academics-api";
import {
  bulkGenerateSalary,
  fetchTeacherSalaries,
  fetchTeacherSalary,
  recordSalaryPayment,
  voidSalaryPayment,
  type FeeStatus,
  type PaymentMethod,
} from "@/lib/finance-api";

type Tab = "general" | "salary";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "general", label: "General" },
  { id: "salary", label: "Salary" },
];

function TeacherAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const url = teacherPhotoUrl(photoUrl);
  if (url) {
    return <img className="student-avatar" src={url} alt="" />;
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return <span className="student-avatar-placeholder">{initials || "?"}</span>;
}

function ConfirmDeleteDialog({
  open,
  title,
  description,
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
          {description}
        </p>
        <div className="drawer-actions">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeacherFormDialog({
  teacher,
  onOpenChange,
}: {
  teacher: TeacherDto | "new" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = teacher !== null && teacher !== "new";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    salary: "",
    nid: "",
    dateOfBirth: "",
    joiningDate: "",
    isActive: true,
  });
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [selectedClassSubjectIds, setSelectedClassSubjectIds] = useState<number[]>([]);

  const classSubjects = useQuery({
    queryKey: ["class-subjects-all"],
    queryFn: fetchAllClassSubjects,
    enabled: teacher !== null,
  });
  const classSubjectsByClass = useMemo(() => {
    const groups = new Map<
      number,
      { classId: number; className: string; classSortOrder: number; subjects: ClassSubjectDto[] }
    >();
    for (const cs of classSubjects.data ?? []) {
      const group =
        groups.get(cs.classId) ??
        { classId: cs.classId, className: cs.className, classSortOrder: cs.classSortOrder, subjects: [] };
      group.subjects.push(cs);
      groups.set(cs.classId, group);
    }
    return Array.from(groups.values()).sort((a, b) => a.classSortOrder - b.classSortOrder);
  }, [classSubjects.data]);

  useEffect(() => {
    if (isEdit && teacher) {
      setForm({
        name: teacher.name,
        salary: teacher.salary != null ? String(teacher.salary) : "",
        nid: teacher.nid ?? "",
        dateOfBirth: teacher.dateOfBirth ?? "",
        joiningDate: teacher.joiningDate ?? "",
        isActive: teacher.isActive,
      });
      setSelectedClassSubjectIds(teacher.assignments.map((a) => a.classSubjectId));
    } else if (teacher === "new") {
      setForm({ name: "", salary: "", nid: "", dateOfBirth: "", joiningDate: "", isActive: true });
      setSelectedClassSubjectIds([]);
    }
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit ? teacher?.id : teacher]);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: form.name,
        salary: form.salary ? parseInt(form.salary, 10) : undefined,
        nid: form.nid || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        joiningDate: form.joiningDate || undefined,
        isActive: form.isActive,
      };
      return isEdit && teacher ? updateTeacher(teacher.id, input) : createTeacher(input);
    },
    // The record itself is always considered saved once this resolves —
    // the photo upload and the class/subject assignment both happen after,
    // and a failure in either is reported separately rather than masking a
    // real create/update as a total failure; the list is refreshed either
    // way so the new row doesn't go missing from view.
    onSuccess: async (saved) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      const problems: string[] = [];

      if (!isEdit && pendingPhoto) {
        try {
          await uploadTeacherPhoto(saved.id, pendingPhoto);
        } catch (error) {
          problems.push(`photo upload failed (${error instanceof ApiError ? error.message : "unknown error"})`);
        }
      }

      const assignmentsChanged =
        !isEdit
          ? selectedClassSubjectIds.length > 0
          : JSON.stringify([...selectedClassSubjectIds].sort()) !==
            JSON.stringify([...teacher!.assignments.map((a) => a.classSubjectId)].sort());
      if (assignmentsChanged) {
        try {
          await setTeacherAssignments(saved.id, selectedClassSubjectIds);
        } catch (error) {
          problems.push(
            `class/subject assignment failed (${error instanceof ApiError ? error.message : "unknown error"})`,
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      if (problems.length > 0) {
        toast.error(`Teacher ${isEdit ? "updated" : "added"}, but ${problems.join(", ")} — edit the row to retry.`);
      } else {
        toast.success(isEdit ? "Teacher updated" : "Teacher added");
      }
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save teacher"),
  });

  const photoUpload = useMutation({
    mutationFn: (file: File) => {
      if (!isEdit || !teacher) throw new Error("Save the teacher before adding a photo");
      return uploadTeacherPhoto(teacher.id, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Photo updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't upload photo"),
  });

  return (
    <Dialog open={teacher !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit teacher" : "Add teacher"}</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label>
            Photo <span className="muted-cell">(optional)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              {isEdit && teacher ? (
                <TeacherAvatar name={teacher.name} photoUrl={teacher.photoUrl} />
              ) : pendingPhotoPreview ? (
                <img
                  src={pendingPhotoPreview}
                  alt=""
                  className="student-avatar"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <TeacherAvatar name={form.name || "?"} photoUrl={null} />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (isEdit && teacher) {
                    photoUpload.mutate(file);
                  } else {
                    setPendingPhoto(file);
                    setPendingPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUpload.isPending}
              >
                <Upload size={14} />
                {photoUpload.isPending
                  ? "Uploading…"
                  : isEdit
                    ? "Change photo"
                    : pendingPhoto
                      ? "Choose a different photo"
                      : "Choose photo"}
              </Button>
            </div>
          </label>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Monthly salary (৳) <span className="muted-cell">(optional)</span>
            <input
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              placeholder="30000"
            />
          </label>
          <label>
            Classes &amp; subjects <span className="muted-cell">(optional)</span>
            <div style={{ display: "grid", gap: 10, maxHeight: 180, overflowY: "auto", marginTop: 4 }}>
              {classSubjects.isLoading && <p className="muted-cell" style={{ fontSize: 12 }}>Loading…</p>}
              {!classSubjects.isLoading && classSubjectsByClass.length === 0 && (
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  No subjects set up on any class yet — add some from Classes &amp; sections first.
                </p>
              )}
              {classSubjectsByClass.map((group) => (
                <div key={group.classId}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600 }}>
                    {group.className}
                  </p>
                  <div style={{ display: "grid", gap: 4 }}>
                    {group.subjects.map((cs) => (
                      <label
                        key={cs.id}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, fontSize: 13 }}
                      >
                        <input
                          type="checkbox"
                          style={{ width: "auto" }}
                          checked={selectedClassSubjectIds.includes(cs.id)}
                          onChange={(e) =>
                            setSelectedClassSubjectIds((prev) =>
                              e.target.checked ? [...prev, cs.id] : prev.filter((id) => id !== cs.id),
                            )
                          }
                        />
                        {cs.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </label>
          <div className="two-fields">
            <label>
              NID
              <input
                value={form.nid}
                onChange={(e) => setForm({ ...form, nid: e.target.value })}
                placeholder="National ID number"
              />
            </label>
            <label>
              Date of birth
              <input
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                placeholder="2015-04-12"
              />
            </label>
          </div>
          <label>
            Joining date
            <input
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
              placeholder="2024-01-10"
            />
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (currently teaching)
          </label>
          {isEdit && !form.isActive && (
            <p className="muted-cell" style={{ fontSize: 12, margin: "-8px 0 0" }}>
              Marked inactive — stays on the roster with all existing records and salary
              history intact; use Delete instead if you need to erase them entirely.
            </p>
          )}
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab() {
  const queryClient = useQueryClient();
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const [editing, setEditing] = useState<TeacherDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TeacherDto | null>(null);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const t of teachers.data ?? []) {
      for (const a of t.assignments) set.add(a.subjectName);
    }
    return Array.from(set).sort();
  }, [teachers.data]);

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (teachers.data ?? []).filter((t) => {
      if (query && !t.name.toLowerCase().includes(query)) return false;
      if (filterSubject && !t.assignments.some((a) => a.subjectName === filterSubject)) return false;
      if (filterStatus === "active" && !t.isActive) return false;
      if (filterStatus === "inactive" && t.isActive) return false;
      return true;
    });
  }, [teachers.data, search, filterSubject, filterStatus]);

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted");
      setDeleting(null);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete teacher"),
  });

  return (
    <Panel>
      <div className="panel-title">
        <h2>Teachers</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} />
          Add teacher
        </Button>
      </div>
      <div className="exam-filters">
        <div className="search-input">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
          />
        </div>
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "inactive")}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <DataTable
        headers={["", "NAME", "SALARY", "CLASSES & SUBJECTS", "NID", "DOB", "JOINING DATE", "STATUS", "ACTIONS"]}
        widths=".7fr 1.3fr 1fr 1.4fr 1.1fr 1fr 1.1fr .8fr .8fr"
      >
        {teachers.isLoading && <EmptyRow colSpan={9}>Loading teachers…</EmptyRow>}
        {!teachers.isLoading && teachers.data?.length === 0 && (
          <EmptyRow colSpan={9}>No teachers yet — add the first one.</EmptyRow>
        )}
        {!teachers.isLoading && (teachers.data?.length ?? 0) > 0 && filteredTeachers.length === 0 && (
          <EmptyRow colSpan={9}>No teachers match your filters.</EmptyRow>
        )}
        {filteredTeachers.map((t) => (
          <tr key={t.id}>
            <td>
              <TeacherAvatar name={t.name} photoUrl={t.photoUrl} />
            </td>
            <td>{t.name}</td>
            <td className="mono muted-cell">{t.salary != null ? `৳${t.salary.toLocaleString("en-BD")}` : "—"}</td>
            <td className="muted-cell">
              {t.assignments.length === 0
                ? "—"
                : t.assignments.map((a) => `${a.subjectName} (${a.className})`).join(", ")}
            </td>
            <td className="mono muted-cell">{t.nid || "—"}</td>
            <td className="muted-cell">{t.dateOfBirth || "—"}</td>
            <td className="muted-cell">{t.joiningDate || "—"}</td>
            <td>
              <Badge tone={t.isActive ? "green" : "neutral"}>{t.isActive ? "Active" : "Inactive"}</Badge>
            </td>
            <td className="row-actions">
              <Button size="icon" variant="ghost" title="Edit teacher" onClick={() => setEditing(t)}>
                <Pencil size={16} />
              </Button>
              <Button size="icon" variant="ghost" title="Delete teacher" onClick={() => setDeleting(t)}>
                <Trash2 size={16} />
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
      <TeacherFormDialog teacher={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDeleteDialog
        open={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        description="Removes the teacher from the roster — this can't be undone from here. Their class/subject assignments, salary records, and payment history are kept for your records, not deleted. If you just need them off the active list temporarily, cancel and edit them to Inactive instead."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </Panel>
  );
}

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusTone: Record<FeeStatus, string> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };
const statusLabel: Record<FeeStatus, string> = { PAID: "Paid", PARTIAL: "Partially Paid", UNPAID: "Unpaid" };
const methodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  bkash: "bKash",
  nagad: "Nagad",
  other: "Other",
};

function GenerateSalaryDialog({
  periodMonth,
  periodYear,
}: {
  periodMonth: number;
  periodYear: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers, enabled: open });

  const withSalary = (teachers.data ?? []).filter((t) => t.salary != null);
  const withoutSalary = (teachers.data ?? []).filter((t) => t.salary == null);

  const mutation = useMutation({
    mutationFn: () =>
      bulkGenerateSalary({
        teacherIds: withSalary.map((t) => t.id),
        periodMonth,
        periodYear,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success(
        `Generated ${res.created} salary record(s)` +
          (res.skipped ? `, skipped ${res.skipped} already set` : ""),
      );
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate salary"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Generate salary
      </Button>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>
            Generate salary — {MONTH_NAMES[periodMonth - 1]} {periodYear}
          </DialogTitle>
        </DialogHeader>
        <div style={{ display: "grid", gap: 14 }}>
          <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
            Creates this month's salary record for every teacher using their own salary (set on
            their roster profile) — teachers who already have a record for this month are
            skipped, not overwritten.
          </p>
          {withSalary.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>
                Will generate for {withSalary.length} teacher(s)
              </p>
              <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                {withSalary.map((t) => (
                  <div
                    key={t.id}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span>{t.name}</span>
                    <span className="mono muted-cell">৳{t.salary!.toLocaleString("en-BD")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {withoutSalary.length > 0 && (
            <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
              Skipping {withoutSalary.length} teacher(s) with no salary set: {" "}
              {withoutSalary.map((t) => t.name).join(", ")} — add a salary on their profile first.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
              No teachers on the roster yet.
            </p>
          )}
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={mutation.isPending || withSalary.length === 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SalaryDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["teacher-salary", id],
    queryFn: () => fetchTeacherSalary(id),
  });
  const d = detail.data;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (d) setAmount(String(d.remaining));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d?.remaining]);

  const pay = useMutation({
    mutationFn: () =>
      recordSalaryPayment(id, {
        amount: parseInt(amount, 10),
        method,
        paidAt,
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salary", id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success("Payment recorded");
      setNote("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't record payment"),
  });

  const voidPayment = useMutation({
    mutationFn: (paymentId: number) => {
      const reason = window.prompt("Reason for voiding this payment?");
      if (!reason || reason.trim().length < 3) throw new Error("cancelled");
      return voidSalaryPayment(paymentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salary", id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success("Payment voided");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't void payment");
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        {d && (
          <>
            <DialogHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 24 }}>
                <DialogTitle>Teacher Salary Details</DialogTitle>
                <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>
              </div>
            </DialogHeader>
            <div>
              <strong style={{ fontSize: 16 }}>{d.teacherName}</strong>
              <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 12 }}>
                {d.teacherSubject ? `${d.teacherSubject} Teacher` : "Teacher"} · T-
                {String(d.teacherId).padStart(4, "0")}
              </p>
            </div>
            <div className="two-fields" style={{ fontSize: 13, rowGap: 14 }}>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Monthly salary
                </span>
                <strong>{money(d.amountDue)}</strong>
              </div>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Paid amount
                </span>
                <strong style={{ color: "var(--green)" }}>{money(d.paid)}</strong>
              </div>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Remaining due
                </span>
                <strong style={{ color: d.remaining > 0 ? "var(--red)" : undefined }}>
                  {money(d.remaining)}
                </strong>
              </div>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Salary month
                </span>
                <strong>
                  {MONTH_NAMES[d.periodMonth - 1]} {d.periodYear}
                </strong>
              </div>
            </div>

            <div>
              <p style={{ margin: "4px 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
                Payment History
              </p>
              {d.payments.length === 0 && (
                <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
                  No payments yet.
                </p>
              )}
              <div style={{ display: "grid", gap: 2 }}>
                {d.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      opacity: p.status === "voided" ? 0.5 : 1,
                    }}
                  >
                    <div>
                      <strong className="mono">{money(p.amount)}</strong>
                      <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 11 }}>
                        {p.paidAt} · {methodLabel[p.method]}
                      </p>
                    </div>
                    {p.status === "voided" ? (
                      <Badge tone="red">Voided</Badge>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge tone="green">Completed</Badge>
                        <Button size="sm" variant="ghost" onClick={() => voidPayment.mutate(p.id)}>
                          Void
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {d.remaining > 0 && (
              <form
                className="student-form"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  pay.mutate();
                }}
              >
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>Make a Payment</p>
                <label>
                  Payment amount
                  <input
                    required
                    type="number"
                    min={1}
                    max={d.remaining}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Payment method
                  <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                    {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                      <label key={m} className={method === m ? "radio-option selected" : "radio-option"}>
                        <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                        {methodLabel[m]}
                      </label>
                    ))}
                  </div>
                </label>
                <label>
                  Payment date
                  <input required type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </label>
                <label>
                  Reference / Note <span className="muted-cell">(optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Transaction ID or payment note"
                  />
                </label>
                <Button type="submit" disabled={pay.isPending}>
                  {pay.isPending ? "Recording…" : "Confirm Payment"}
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SalaryTab() {
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FeeStatus>("ALL");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState<number | "">(""); // classId, not level
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const salaries = useQuery({
    queryKey: ["teacher-salaries", periodMonth, periodYear],
    queryFn: () => fetchTeacherSalaries({ periodMonth, periodYear, pageSize: 200 }),
  });
  const rows = salaries.data?.rows ?? [];

  // Salary records aren't per class/subject (a teacher has one salary a
  // month, however many classes they teach) — filtering "by subject/class"
  // means showing only teachers who have that assignment, via the roster's
  // own assignments list.
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const assignmentsByTeacher = useMemo(() => {
    const map = new Map<number, TeacherDto["assignments"]>();
    for (const t of teachersQuery.data ?? []) map.set(t.id, t.assignments);
    return map;
  }, [teachersQuery.data]);
  // Filter options list the full catalog/every class, not just the ones a
  // teacher currently happens to be assigned to — otherwise a subject or
  // class nobody's assigned to yet would be impossible to even select.
  const subjectCatalogQuery = useQuery({ queryKey: ["subject-catalog"], queryFn: fetchSubjectCatalog });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const subjectOptions = useMemo(
    () => (subjectCatalogQuery.data ?? []).map((s) => s.name).sort(),
    [subjectCatalogQuery.data],
  );
  const classOptions = useMemo(
    () =>
      [...(classesQuery.data ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c): [number, string] => [c.id, c.name]),
    [classesQuery.data],
  );

  const totals = useMemo(() => {
    const totalSalary = rows.reduce((s, r) => s + r.amountDue, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const partiallyPaidDue = rows
      .filter((r) => r.status === "PARTIAL")
      .reduce((s, r) => s + r.remaining, 0);
    const unpaidDue = rows
      .filter((r) => r.status === "UNPAID")
      .reduce((s, r) => s + r.amountDue, 0);
    return { totalSalary, totalPaid, partiallyPaidDue, unpaidDue, remaining: totalSalary - totalPaid };
  }, [rows]);

  const progressPct = totals.totalSalary > 0 ? Math.round((totals.totalPaid / totals.totalSalary) * 1000) / 10 : 0;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (query && !r.teacherName.toLowerCase().includes(query)) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      const assignments = assignmentsByTeacher.get(r.teacherId) ?? [];
      if (subjectFilter && !assignments.some((a) => a.subjectName === subjectFilter)) return false;
      if (classFilter !== "" && !assignments.some((a) => a.classId === classFilter)) return false;
      return true;
    });
  }, [rows, search, statusFilter, subjectFilter, classFilter, assignmentsByTeacher]);

  return (
    <>
      <div className="panel-title" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={periodYear}
            onChange={(e) => setPeriodYear(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </div>
        <GenerateSalaryDialog periodMonth={periodMonth} periodYear={periodYear} />
      </div>

      <div className="stat-grid">
        <Panel className="stat stat-blue">
          <div className="stat-top">
            <span className="stat-icon stat-icon-blue">
              <Wallet />
            </span>
          </div>
          <strong>{money(totals.totalSalary)}</strong>
          <span>Total Salary</span>
        </Panel>
        <Panel className="stat stat-green">
          <div className="stat-top">
            <span className="stat-icon stat-icon-green">
              <CheckCircle2 />
            </span>
          </div>
          <strong>{money(totals.totalPaid)}</strong>
          <span>Total Paid</span>
        </Panel>
        <Panel className="stat stat-orange">
          <div className="stat-top">
            <span className="stat-icon stat-icon-orange">
              <AlertCircle />
            </span>
          </div>
          <strong>{money(totals.partiallyPaidDue)}</strong>
          <span>Partially Paid</span>
        </Panel>
        <Panel className="stat stat-pink">
          <div className="stat-top">
            <span className="stat-icon stat-icon-pink">
              <AlertTriangle />
            </span>
          </div>
          <strong>{money(totals.unpaidDue)}</strong>
          <span>Unpaid / Outstanding</span>
        </Panel>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Panel>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Salary Payment Progress</strong>
              <strong style={{ fontSize: 13, color: "var(--green)" }}>{progressPct}%</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(progressPct, 100)}%`, background: "var(--green)" }}
              />
            </div>
            <div
              className="muted-cell"
              style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}
            >
              <span>Paid: {money(totals.totalPaid)}</span>
              <span>Remaining: {money(totals.remaining)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="panel-title">
          <h2>Teacher Salary Records</h2>
          <Badge tone="teal">{rows.length} Teachers</Badge>
        </div>
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="search-input" style={{ flex: "1 1 220px" }}>
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher…"
              />
            </div>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="">All subjects</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">All classes</option>
              {classOptions.map(([classId, name]) => (
                <option key={classId} value={classId}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="finance-tabs">
            {(["ALL", "PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? "finance-tab active" : "finance-tab"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? "All" : statusLabel[s]}
              </button>
            ))}
          </div>
        </div>

        {salaries.isLoading && <p className="muted-cell" style={{ padding: 16 }}>Loading…</p>}
        {!salaries.isLoading && rows.length === 0 && (
          <p className="muted-cell" style={{ padding: 16 }}>
            No salary records for {MONTH_NAMES[periodMonth - 1]} {periodYear} yet — generate them
            above.
          </p>
        )}
        {!salaries.isLoading && rows.length > 0 && filteredRows.length === 0 && (
          <p className="muted-cell" style={{ padding: 16 }}>
            No teachers match your filters.
          </p>
        )}
        {filteredRows.map((r) => {
          const pct = r.amountDue > 0 ? Math.min(100, Math.round((r.paid / r.amountDue) * 100)) : 0;
          return (
            <div key={r.id} className="salary-row" onClick={() => setSelectedId(r.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{r.teacherName}</strong>
                  <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 12 }}>
                    {r.teacherSubject ? `${r.teacherSubject} Teacher` : "Teacher"}
                  </p>
                </div>
                <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0 6px", fontSize: 12 }}>
                <span className="muted-cell">Salary: {money(r.amountDue)}</span>
                <span>Paid: {money(r.paid)}</span>
              </div>
              <div className="progress-track progress-track-sm">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, background: r.status === "UNPAID" ? "var(--red)" : "var(--green)" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span className="muted-cell" style={{ fontSize: 12 }}>
                  Due: {money(r.remaining)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(r.id);
                  }}
                >
                  View / Pay
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </Panel>

      {selectedId !== null && (
        <SalaryDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

export function TeachersPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <>
      <PageHeading title="Teachers" subtitle="Teacher roster and monthly salary records" />
      <div className="finance-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "finance-tab active" : "finance-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "general" && <GeneralTab />}
      {tab === "salary" && <SalaryTab />}
    </>
  );
}
