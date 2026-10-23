import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchClasses } from "@/lib/academics-api";
import {
  studentPhotoUrl,
  updateStudent,
  uploadStudentPhoto,
  type GuardianRelation,
  type StudentDto,
} from "@/lib/students-api";
import { ApiError } from "@/lib/api";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function formFromStudent(student: StudentDto) {
  const guardian = student.guardians[0];
  return {
    name: student.name,
    roll: String(student.roll),
    classId: String(student.classId),
    sectionId: String(student.sectionId),
    dateOfBirth: student.dateOfBirth ?? "",
    isActive: student.isActive,
    guardianName: guardian?.name ?? "",
    guardianRelation: (guardian?.relation ?? "father") as GuardianRelation,
    guardianPhone: guardian?.phone ?? "",
    guardianEmail: guardian?.email ?? "",
  };
}

export function EditStudentDrawer({
  student,
  onOpenChange,
}: {
  student: StudentDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [form, setForm] = useState(() => (student ? formFromStudent(student) : null));
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the form whenever a (possibly different) student is opened for
  // editing — never while the same drawer is just re-rendering, so
  // in-progress edits aren't clobbered by a background students refetch.
  useEffect(() => {
    if (student) {
      setForm(formFromStudent(student));
      setPhoto(null);
      setPhotoPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const pickPhoto = (file: File | null) => {
    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG or PNG photos are allowed");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be 2MB or smaller");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const selectedClass = classes.data?.find((c) => String(c.id) === form?.classId);
  const sections = selectedClass?.sections ?? [];
  const existingPhotoUrl = student ? studentPhotoUrl(student.photoUrl) : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!student || !form) throw new Error("No student selected");
      const updated = await updateStudent(student.id, {
        name: form.name,
        roll: parseInt(form.roll, 10),
        classId: parseInt(form.classId, 10),
        sectionId: parseInt(form.sectionId, 10),
        dateOfBirth: form.dateOfBirth || undefined,
        isActive: form.isActive,
        guardian: form.guardianName
          ? {
              name: form.guardianName,
              relation: form.guardianRelation,
              phone: form.guardianPhone || undefined,
              email: form.guardianEmail || undefined,
            }
          : undefined,
      });
      if (photo) {
        try {
          await uploadStudentPhoto(student.id, photo);
        } catch {
          toast.error(`${updated.name} was updated, but the photo failed to upload — try again`);
        }
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(`${updated.name} updated`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update student");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form?.classId || !form.sectionId) {
      toast.error("Choose a class and section");
      return;
    }
    mutation.mutate();
  };

  return (
    <Sheet open={!!student} onOpenChange={onOpenChange}>
      <SheetContent className="student-drawer" side="right">
        <SheetHeader>
          <SheetTitle>Edit student</SheetTitle>
        </SheetHeader>
        {student && form && (
          <form onSubmit={submit} className="student-form">
            <button
              type="button"
              className="photo-upload-cell photo-upload-cell-lg"
              onClick={() => photoInputRef.current?.click()}
              title={photo || existingPhotoUrl ? "Change photo" : "Upload photo"}
            >
              {photoPreview || existingPhotoUrl ? (
                <img src={photoPreview ?? existingPhotoUrl ?? ""} alt="" />
              ) : (
                <Camera size={22} className="muted-cell" />
              )}
              <span className="photo-upload-overlay">
                {photo || existingPhotoUrl ? "Change" : "Upload"}
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
            <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
              Code {student.code} · Biometric ID {student.biometricId} (device PIN, not editable
              here)
            </p>
            <div className="two-fields">
              <label>
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Student's full name"
                />
              </label>
              <label>
                Roll
                <input
                  required
                  type="number"
                  min={1}
                  value={form.roll}
                  onChange={(e) => setForm({ ...form, roll: e.target.value })}
                  placeholder="56"
                />
              </label>
            </div>
            <div className="two-fields">
              <label>
                Class
                <select
                  required
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })}
                >
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
                Section
                <select
                  required
                  value={form.sectionId}
                  disabled={!form.classId}
                  onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                >
                  <option value="" disabled>
                    Select section
                  </option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="two-fields">
              <label>
                Date of birth
                <input
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  placeholder="2015-04-12"
                />
              </label>
              <label>
                Status
                <select
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <hr />
            <p>Guardian</p>
            <div className="two-fields">
              <label>
                Name
                <input
                  value={form.guardianName}
                  onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                  placeholder="Guardian's name"
                />
              </label>
              <label>
                Relation
                <select
                  value={form.guardianRelation}
                  onChange={(e) =>
                    setForm({ ...form, guardianRelation: e.target.value as GuardianRelation })
                  }
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="two-fields">
              <label>
                Phone
                <input
                  value={form.guardianPhone}
                  onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                  placeholder="01700-000000"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                  placeholder="guardian@email.com"
                />
              </label>
            </div>
            <div className="drawer-actions">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
