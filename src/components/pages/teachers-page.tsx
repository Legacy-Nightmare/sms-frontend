import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
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

export function TeachersPage() {
  return (
    <>
      <PageHeading title="Teachers" subtitle="Teacher roster — salary is now managed under Finance" />
      <GeneralTab />
    </>
  );
}
