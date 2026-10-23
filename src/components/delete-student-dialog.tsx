import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteStudent, type StudentDto } from "@/lib/students-api";
import { ApiError } from "@/lib/api";

export function DeleteStudentDialog({
  student,
  onOpenChange,
}: {
  student: StudentDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: number) => deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success(`${student?.name} removed`);
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete student"),
  });

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Delete {student?.name}?</DialogTitle>
        </DialogHeader>
        <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
          This permanently removes {student?.name} ({student?.code}) and all their attendance,
          marks, and fee records. This cannot be undone.
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
            onClick={() => student && remove.mutate(student.id)}
          >
            {remove.isPending ? "Deleting…" : "Delete student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
