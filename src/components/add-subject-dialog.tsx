import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSubject, fetchSubjects } from "@/lib/exams-api";
import { fetchSubjectCatalog } from "@/lib/subjects-catalog-api";
import { ApiError } from "@/lib/api";

export function AddSubjectDialog({
  classId,
  className,
  trigger,
}: {
  classId: number;
  className: string;
  trigger?: "button" | "chip";
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [fullMarks, setFullMarks] = useState("100");

  const catalog = useQuery({ queryKey: ["subject-catalog"], queryFn: fetchSubjectCatalog, enabled: open });
  const existing = useQuery({
    queryKey: ["subjects", classId],
    queryFn: () => fetchSubjects(classId),
    enabled: open,
  });
  const alreadyAdded = new Set((existing.data ?? []).map((s) => s.subjectId));
  const available = (catalog.data ?? []).filter((c) => !alreadyAdded.has(c.id));
  const selected = available.find((c) => c.id === subjectId);

  const mutation = useMutation({
    mutationFn: () => {
      if (subjectId === "") throw new Error("no subject selected");
      return createSubject({ subjectId, classId, fullMarks: parseInt(fullMarks, 10) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", classId] });
      toast.success(`${selected?.name ?? "Subject"} added to ${className}`);
      setOpen(false);
      setSubjectId("");
      setFullMarks("100");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't add subject"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === "chip" ? (
        <button
          type="button"
          className="badge"
          onClick={() => setOpen(true)}
          aria-label={`Add subject to ${className}`}
        >
          <Plus style={{ width: 11, height: 11 }} />
        </button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus />
          Add subject
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subject to {className}</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="two-fields">
            <label>
              Subject
              <select
                required
                value={subjectId}
                onChange={(e) => {
                  const id = e.target.value ? parseInt(e.target.value, 10) : "";
                  const picked = available.find((c) => c.id === id);
                  setSubjectId(id);
                  setFullMarks(String(picked?.defaultFullMarks ?? 100));
                }}
              >
                <option value="">Select subject…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Full marks
              <input
                required
                type="number"
                min={1}
                value={fullMarks}
                onChange={(e) => setFullMarks(e.target.value)}
              />
            </label>
          </div>
          {available.length === 0 && (
            <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
              No subjects available to add — create one on the Subjects page first.
            </p>
          )}
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending || subjectId === ""}>
              {mutation.isPending ? "Saving…" : "Save subject"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
