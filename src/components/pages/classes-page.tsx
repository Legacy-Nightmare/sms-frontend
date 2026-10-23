import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, PageHeading, Panel } from "@/components/dashboard-ui";
import {
  createClass,
  createSection,
  deleteSection,
  fetchClasses,
  updateResultWeights,
  updateSection,
  type ClassDto,
} from "@/lib/academics-api";
import {
  createSubject,
  deleteSubject,
  fetchSubjects,
  updateSubject,
  type SubjectDto,
} from "@/lib/exams-api";
import { ApiError } from "@/lib/api";

const classTones = [
  "orange",
  "mint",
  "purple",
  "blue",
  "pink",
  "lime",
  "orange",
  "mint",
  "purple",
  "blue",
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function AddClassDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(`Class ${name} added`);
      setOpen(false);
      setLevel("");
      setName("");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't add class")),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ level: parseInt(level, 10), name });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add class
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add class</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="student-form">
          <div className="two-fields">
            <label>
              Level
              <input
                required
                type="number"
                min={1}
                max={10}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="11"
              />
            </label>
            <label>
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Class 11"
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
              {mutation.isPending ? "Saving…" : "Save class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SectionRow {
  id?: number;
  name: string;
  originalName?: string;
}

interface SubjectRow {
  id?: number;
  name: string;
  fullMarks: number;
  originalName?: string;
  originalFullMarks?: number;
}

// One modal for everything a class needs editing — weights, sections, and
// subjects used to be three separate scattered affordances (a tiny clickable
// badge for weights, a "+" chip for sections, another "+" chip for subjects),
// none of which supported renaming or removing an existing entry at all.
function EditClassDialog({
  classItem,
  onOpenChange,
}: {
  classItem: ClassDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tutorialWeight, setTutorialWeight] = useState("20");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [deletedSectionIds, setDeletedSectionIds] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [deletedSubjectIds, setDeletedSubjectIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const seededSubjectsForClassId = useRef<number | null>(null);

  const subjectsQuery = useQuery({
    queryKey: ["subjects", classItem?.id],
    queryFn: () => fetchSubjects(classItem!.id),
    enabled: !!classItem,
  });

  // Depends on the classItem *object* (not just its id) deliberately — this
  // dialog never unmounts between opens (ClassesPage always renders it, just
  // with classItem=null while closed), so re-opening the *same* class would
  // never re-seed if this only watched the id, which stays identical across
  // a close/reopen cycle. Each click of a card's edit button hands in a
  // fresh object pulled from the latest `classes` query, including right
  // after a save, so keying on object identity re-seeds exactly when it
  // should: every genuine open, but not on an unrelated background refetch
  // while already open (classItem itself doesn't change then).
  useEffect(() => {
    if (classItem) {
      setTutorialWeight(String(classItem.tutorialWeightPercent));
      setSections(classItem.sections.map((s) => ({ id: s.id, name: s.name, originalName: s.name })));
      setDeletedSectionIds([]);
      setDeletedSubjectIds([]);
      // Forces the subjects effect below to reseed too, even if it's the
      // same class as last time — otherwise a subject created in the
      // previous session would stay in local state with no id forever,
      // since react-query's cached data for that class doesn't change
      // reference just because this effect re-ran.
      seededSubjectsForClassId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classItem]);

  // Seeded once per open (see above), not on every background refetch while
  // the dialog is already open — otherwise an in-progress edit would get
  // clobbered the moment react-query silently revalidates in the background.
  useEffect(() => {
    if (classItem && subjectsQuery.data && seededSubjectsForClassId.current !== classItem.id) {
      setSubjects(
        subjectsQuery.data.map((s: SubjectDto) => ({
          id: s.id,
          name: s.name,
          fullMarks: s.fullMarks,
          originalName: s.name,
          originalFullMarks: s.fullMarks,
        })),
      );
      seededSubjectsForClassId.current = classItem.id;
    }
  }, [classItem, subjectsQuery.data]);

  if (!classItem) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const finalWeight = 100 - (parseInt(tutorialWeight, 10) || 0);

  const removeSectionRow = (index: number) => {
    setSections((prev) => {
      const row = prev[index];
      if (row?.id) setDeletedSectionIds((ids) => [...ids, row.id!]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeSubjectRow = (index: number) => {
    setSubjects((prev) => {
      const row = prev[index];
      if (row?.id) setDeletedSubjectIds((ids) => [...ids, row.id!]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const errors: string[] = [];

    const newTutorial = parseInt(tutorialWeight, 10);
    if (!Number.isNaN(newTutorial) && newTutorial !== classItem.tutorialWeightPercent) {
      try {
        await updateResultWeights(classItem.id, {
          tutorialWeightPercent: newTutorial,
          finalWeightPercent: 100 - newTutorial,
        });
      } catch (error) {
        errors.push(errorMessage(error, "Couldn't update result weights"));
      }
    }

    for (const id of deletedSectionIds) {
      try {
        await deleteSection(id);
      } catch (error) {
        errors.push(errorMessage(error, "Couldn't delete a section"));
      }
    }
    for (const section of sections) {
      const name = section.name.trim();
      if (!name) continue;
      if (section.id && name !== section.originalName) {
        try {
          await updateSection(section.id, { name });
        } catch (error) {
          errors.push(errorMessage(error, `Couldn't rename section "${section.originalName}"`));
        }
      } else if (!section.id) {
        try {
          await createSection({ name, classId: classItem.id });
        } catch (error) {
          errors.push(errorMessage(error, `Couldn't add section "${name}"`));
        }
      }
    }

    for (const id of deletedSubjectIds) {
      try {
        await deleteSubject(id);
      } catch (error) {
        errors.push(errorMessage(error, "Couldn't delete a subject"));
      }
    }
    for (const subject of subjects) {
      const name = subject.name.trim();
      if (!name) continue;
      if (subject.id && (name !== subject.originalName || subject.fullMarks !== subject.originalFullMarks)) {
        try {
          await updateSubject(subject.id, { name, fullMarks: subject.fullMarks });
        } catch (error) {
          errors.push(errorMessage(error, `Couldn't update subject "${subject.originalName}"`));
        }
      } else if (!subject.id) {
        try {
          await createSubject({ name, classId: classItem.id, fullMarks: subject.fullMarks || 100 });
        } catch (error) {
          errors.push(errorMessage(error, `Couldn't add subject "${name}"`));
        }
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["classes"] });
    await queryClient.invalidateQueries({ queryKey: ["subjects", classItem.id] });
    setSaving(false);

    if (errors.length > 0) {
      errors.forEach((message) => toast.error(message));
    } else {
      toast.success(`Class ${classItem.level} updated`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={!!classItem} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>Edit Class {classItem.level}</DialogTitle>
        </DialogHeader>
        <div className="student-form">
          <label>
            Result weight — Tutorial (%)
            <input
              type="number"
              min={0}
              max={100}
              value={tutorialWeight}
              onChange={(e) => setTutorialWeight(e.target.value)}
            />
          </label>
          <p className="muted-cell" style={{ fontSize: 12, margin: "-8px 0 0" }}>
            Final weight will be set to {finalWeight}% (always adds up to 100).
          </p>

          <hr />

          <div>
            <p className="editable-row-label">Sections</p>
            {sections.map((section, index) => (
              <div className="editable-row" key={section.id ?? `new-${index}`}>
                <input
                  type="text"
                  value={section.name}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  placeholder="Section name"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title="Remove section"
                  onClick={() => removeSectionRow(index)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSections((prev) => [...prev, { name: "" }])}
            >
              <Plus size={14} />
              Add section
            </Button>
          </div>

          <hr />

          <div>
            <p className="editable-row-label">Subjects</p>
            {subjectsQuery.isLoading && <p className="muted-cell" style={{ fontSize: 12 }}>Loading…</p>}
            {subjects.map((subject, index) => (
              <div className="editable-row" key={subject.id ?? `new-${index}`}>
                <input
                  type="text"
                  value={subject.name}
                  onChange={(e) =>
                    setSubjects((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  placeholder="Subject name"
                />
                <input
                  type="number"
                  min={1}
                  className="fullmarks-input"
                  value={subject.fullMarks}
                  onChange={(e) =>
                    setSubjects((prev) =>
                      prev.map((s, i) =>
                        i === index ? { ...s, fullMarks: parseInt(e.target.value, 10) || 0 } : s,
                      ),
                    )
                  }
                  title="Full marks"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title="Remove subject"
                  onClick={() => removeSubjectRow(index)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSubjects((prev) => [...prev, { name: "", fullMarks: 100 }])}
            >
              <Plus size={14} />
              Add subject
            </Button>
          </div>

          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClassCard({
  classItem,
  tone,
  onEdit,
}: {
  classItem: ClassDto;
  tone: string;
  onEdit: () => void;
}) {
  const subjects = useQuery({
    queryKey: ["subjects", classItem.id],
    queryFn: () => fetchSubjects(classItem.id),
  });

  return (
    <Panel className={`class-card class-${tone}`}>
      <Button
        size="icon"
        variant="outline"
        className="class-card-edit-btn"
        title={`Edit Class ${classItem.level}`}
        onClick={onEdit}
      >
        <Pencil size={14} />
      </Button>
      <div>
        <h2>Class {classItem.level}</h2>
        <span className="mono">{classItem.studentCount} students</span>
      </div>
      <p>
        {classItem.sections.map((s) => (
          <Badge key={s.id} tone={s.name === "RUP" ? "amber" : "teal"}>
            {s.name} · {s.studentCount ?? 0}
          </Badge>
        ))}
      </p>
      <div style={{ marginTop: 10 }}>
        <span className="muted-cell" style={{ fontSize: 11 }}>
          Subjects
        </span>
        <p style={{ margin: "6px 0 0" }}>
          {!subjects.isLoading && subjects.data?.length === 0 && (
            <span className="muted-cell" style={{ fontSize: 12 }}>
              None yet
            </span>
          )}
          {subjects.data?.map((subject) => (
            <Badge key={subject.id} tone="purple">
              {subject.name} · {subject.fullMarks}
            </Badge>
          ))}
        </p>
      </div>
      <div style={{ marginTop: 10 }}>
        <span className="muted-cell" style={{ fontSize: 12 }}>
          Tutorial {classItem.tutorialWeightPercent}% / Final {classItem.finalWeightPercent}%
        </span>
      </div>
    </Panel>
  );
}

export function ClassesPage() {
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const totalSections = classes.data?.reduce((sum, c) => sum + c.sections.length, 0) ?? 0;
  const [editingClass, setEditingClass] = useState<ClassDto | null>(null);

  return (
    <>
      <PageHeading
        title="Classes & sections"
        subtitle={`${classes.data?.length ?? 0} classes, ${totalSections} sections`}
        action={<AddClassDialog />}
      />
      <div className="class-grid">
        {classes.isLoading && <Panel className="class-card">Loading…</Panel>}
        {classes.data?.map((c, i) => (
          <ClassCard
            key={c.id}
            classItem={c}
            tone={classTones[i % classTones.length] ?? "orange"}
            onEdit={() => setEditingClass(c)}
          />
        ))}
      </div>

      <EditClassDialog
        classItem={editingClass}
        onOpenChange={(open) => !open && setEditingClass(null)}
      />
    </>
  );
}
