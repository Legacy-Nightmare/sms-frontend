import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { StudentAvatar } from "@/components/student-avatar";
import { EditStudentDrawer } from "@/components/edit-student-drawer";
import { DeleteStudentDialog } from "@/components/delete-student-dialog";
import { fetchStudents, studentPhotoUrl, type StudentDto } from "@/lib/students-api";
import { fetchClasses } from "@/lib/academics-api";
import { fetchDashboardSummary } from "@/lib/dashboard-api";

// Purely a display element — photo management lives in the Edit drawer so
// clicking the row's own picture never surprises anyone with a file picker.
// With no photo on file there's nothing to view, so no hover affordance.
function StudentAvatarCell({ student }: { student: StudentDto }) {
  const [viewOpen, setViewOpen] = useState(false);
  const url = studentPhotoUrl(student.photoUrl);

  if (!url) {
    return <StudentAvatar name={student.name} photoUrl={null} size="lg" />;
  }

  return (
    <>
      <button
        type="button"
        className="photo-upload-cell"
        onClick={() => setViewOpen(true)}
        title="View image"
      >
        <StudentAvatar name={student.name} photoUrl={student.photoUrl} size="lg" />
        <span className="photo-upload-overlay">View image</span>
      </button>
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent style={{ maxWidth: 420 }}>
          <img
            src={url}
            alt={student.name}
            style={{ width: "100%", borderRadius: 12, display: "block" }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StudentsPage({ onAdd }: { onAdd: () => void }) {
  const students = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: fetchDashboardSummary });
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentDto | null>(null);
  const [search, setSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState<number | "">("");
  const [filterSectionId, setFilterSectionId] = useState<number | "">("");
  const [filterRoll, setFilterRoll] = useState("");

  const availableSections = useMemo(() => {
    if (!classes.data) return [];
    if (filterClassId === "") return classes.data.flatMap((c) => c.sections);
    return classes.data.find((c) => c.id === filterClassId)?.sections ?? [];
  }, [classes.data, filterClassId]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (students.data ?? []).filter((s) => {
      if (query && !s.name.toLowerCase().includes(query) && !s.code.toLowerCase().includes(query)) {
        return false;
      }
      if (filterClassId !== "" && s.classId !== filterClassId) return false;
      if (filterSectionId !== "" && s.sectionId !== filterSectionId) return false;
      if (filterRoll.trim() && String(s.roll) !== filterRoll.trim()) return false;
      return true;
    });
  }, [students.data, search, filterClassId, filterSectionId, filterRoll]);

  return (
    <>
      <PageHeading
        title="Students"
        subtitle={`${summary.data?.totalStudents ?? students.data?.length ?? 0} students · code is class-section-roll, biometric ID is the device PIN`}
        action={
          <Button onClick={onAdd}>
            <Plus />
            Add student
          </Button>
        }
      />
      <Panel>
        <div className="exam-filters">
          <div className="search-input">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
            />
          </div>
          <select
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value ? parseInt(e.target.value, 10) : "");
              setFilterSectionId("");
            }}
          >
            <option value="">All classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.level}
              </option>
            ))}
          </select>
          <select
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value ? parseInt(e.target.value, 10) : "")}
          >
            <option value="">All sections</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={filterRoll}
            onChange={(e) => setFilterRoll(e.target.value)}
            placeholder="Roll"
            style={{ flex: "0 0 90px" }}
          />
        </div>
        <DataTable
          className="students-table"
          headers={[
            "",
            "CODE",
            "BIOMETRIC ID",
            "NAME",
            "CLASS",
            "ROLL",
            "GUARDIAN",
            "STATUS",
            "ACTIONS",
          ]}
          widths=".8fr 1fr 1fr 1.1fr 1.3fr .55fr 1.85fr .9fr .8fr"
        >
          {students.isLoading && <EmptyRow colSpan={9}>Loading students…</EmptyRow>}
          {!students.isLoading && students.data?.length === 0 && (
            <EmptyRow colSpan={9}>No students yet — add the first one.</EmptyRow>
          )}
          {!students.isLoading && (students.data?.length ?? 0) > 0 && filteredStudents.length === 0 && (
            <EmptyRow colSpan={9}>No students match your filters.</EmptyRow>
          )}
          {filteredStudents.map((s) => {
            const guardian = s.guardians[0];
            return (
              <tr key={s.id}>
                <td>
                  <StudentAvatarCell student={s} />
                </td>
                <td className="mono muted-cell">{s.code}</td>
                <td className="mono muted-cell">{s.biometricId}</td>
                <td>{s.name}</td>
                <td>
                  Class {s.classEntity.level}{" "}
                  <Badge tone={s.section.name === "RUP" ? "amber" : "teal"}>{s.section.name}</Badge>
                </td>
                <td>{s.roll}</td>
                <td>
                  {guardian ? (
                    <>
                      <span className={`guardian-dot ${guardian.relation}`} />
                      {guardian.name} ({guardian.relation})
                    </>
                  ) : (
                    <span className="muted-cell">No guardian on file</span>
                  )}
                </td>
                <td>
                  <Badge tone={s.isActive ? "green" : "neutral"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="row-actions">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit student"
                    onClick={() => setEditingStudent(s)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete student"
                    onClick={() => setDeletingStudent(s)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <EditStudentDrawer
        student={editingStudent}
        onOpenChange={(open) => !open && setEditingStudent(null)}
      />
      <DeleteStudentDialog
        student={deletingStudent}
        onOpenChange={(open) => !open && setDeletingStudent(null)}
      />
    </>
  );
}
