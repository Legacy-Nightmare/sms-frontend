import { useEffect, useState, type FormEvent } from "react";
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
import { DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { ApiError } from "@/lib/api";
import {
  createSubjectCatalogEntry,
  deleteSubjectCatalogEntry,
  fetchSubjectCatalog,
  updateSubjectCatalogEntry,
  type SubjectCatalogDto,
} from "@/lib/subjects-catalog-api";

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

function SubjectFormDialog({
  subject,
  onOpenChange,
}: {
  subject: SubjectCatalogDto | "new" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = subject !== null && subject !== "new";
  const [name, setName] = useState("");
  const [defaultFullMarks, setDefaultFullMarks] = useState("");

  useEffect(() => {
    if (isEdit && subject) {
      setName(subject.name);
      setDefaultFullMarks(subject.defaultFullMarks != null ? String(subject.defaultFullMarks) : "");
    } else if (subject === "new") {
      setName("");
      setDefaultFullMarks("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit ? subject?.id : subject]);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name,
        defaultFullMarks: defaultFullMarks ? parseInt(defaultFullMarks, 10) : undefined,
      };
      return isEdit && subject ? updateSubjectCatalogEntry(subject.id, input) : createSubjectCatalogEntry(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-catalog"] });
      toast.success(isEdit ? "Subject updated" : "Subject added");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save subject"),
  });

  return (
    <Dialog open={subject !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit subject" : "Add subject"}</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Bangla" />
          </label>
          <label>
            Default full marks <span className="muted-cell">(optional)</span>
            <input
              type="number"
              min={1}
              value={defaultFullMarks}
              onChange={(e) => setDefaultFullMarks(e.target.value)}
              placeholder="100"
            />
          </label>
          <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
            Used as the starting marks total when a class adds this subject — each class can still
            change its own value afterward.
          </p>
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

export function SubjectsPage() {
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: ["subject-catalog"], queryFn: fetchSubjectCatalog });
  const [editing, setEditing] = useState<SubjectCatalogDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<SubjectCatalogDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => deleteSubjectCatalogEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-catalog"] });
      toast.success("Subject deleted");
      setDeleting(null);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete subject"),
  });

  return (
    <>
      <PageHeading
        title="Subjects"
        subtitle="The shared subject list classes pick from — add a subject once, reuse it everywhere"
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus />
            Add subject
          </Button>
        }
      />
      <Panel>
        <DataTable headers={["NAME", "DEFAULT FULL MARKS", "ACTIONS"]} widths="2fr 1.3fr 1fr">
          {subjects.isLoading && <EmptyRow colSpan={3}>Loading…</EmptyRow>}
          {!subjects.isLoading && subjects.data?.length === 0 && (
            <EmptyRow colSpan={3}>No subjects yet — add the first one.</EmptyRow>
          )}
          {subjects.data?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="mono muted-cell">{s.defaultFullMarks ?? "—"}</td>
              <td className="row-actions">
                <Button size="icon" variant="ghost" title="Edit subject" onClick={() => setEditing(s)}>
                  <Pencil size={16} />
                </Button>
                <Button size="icon" variant="ghost" title="Delete subject" onClick={() => setDeleting(s)}>
                  <Trash2 size={16} />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <SubjectFormDialog subject={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDeleteDialog
        open={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        description="Subjects already added to a class keep working — this only removes it from the add-subject dropdown for new classes. Blocked if any class still has it attached."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </>
  );
}
