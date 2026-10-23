import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createSubject } from "@/lib/exams-api";
import { ApiError } from "@/lib/api";

export function AddSubjectDialog({
  classId,
  classLevel,
  trigger,
}: {
  classId: number;
  classLevel: number;
  trigger?: "button" | "chip";
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fullMarks, setFullMarks] = useState("100");

  const mutation = useMutation({
    mutationFn: () => createSubject({ name, classId, fullMarks: parseInt(fullMarks, 10) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", classId] });
      toast.success(`${name} added to Class ${classLevel}`);
      setOpen(false);
      setName("");
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
          aria-label={`Add subject to Class ${classLevel}`}
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
          <DialogTitle>Add subject to Class {classLevel}</DialogTitle>
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
              Subject name
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Bangla" />
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
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save subject"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
