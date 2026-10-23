import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchClasses } from "@/lib/academics-api";
import { createFeeType, fetchClassFees, fetchFeeTypes, upsertClassFee } from "@/lib/finance-api";
import { ApiError } from "@/lib/api";

export function FeeTypeSettingsDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newFeeTypeName, setNewFeeTypeName] = useState("");
  const [classId, setClassId] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses, enabled: open });
  const feeTypes = useQuery({ queryKey: ["fee-types"], queryFn: fetchFeeTypes, enabled: open });
  const classFees = useQuery({
    queryKey: ["class-fees", classId],
    queryFn: () => fetchClassFees(parseInt(classId, 10)),
    enabled: open && !!classId,
  });

  const addFeeType = useMutation({
    mutationFn: () => createFeeType(newFeeTypeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      toast.success(`"${newFeeTypeName}" added`);
      setNewFeeTypeName("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't add fee type"),
  });

  const saveAmount = useMutation({
    mutationFn: (feeTypeId: number) =>
      upsertClassFee({
        classId: parseInt(classId, 10),
        feeTypeId,
        amount: parseInt(amounts[feeTypeId] ?? "0", 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-fees", classId] });
      toast.success("Amount saved");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save amount"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings />
        Fee types & amounts
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fee types &amp; per-class amounts</DialogTitle>
        </DialogHeader>
        <div style={{ display: "grid", gap: 18 }}>
          <form
            className="two-fields"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              addFeeType.mutate();
            }}
          >
            <label>
              New fee type
              <input
                required
                value={newFeeTypeName}
                onChange={(e) => setNewFeeTypeName(e.target.value)}
                placeholder="e.g. Exam Fee"
              />
            </label>
            <Button type="submit" disabled={addFeeType.isPending} style={{ alignSelf: "end" }}>
              {addFeeType.isPending ? "Adding…" : "Add"}
            </Button>
          </form>

          <label>
            Set amounts for class
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select a class</option>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Class {c.level}
                </option>
              ))}
            </select>
          </label>

          {classId && (
            <div style={{ display: "grid", gap: 8 }}>
              {feeTypes.data?.map((ft) => {
                const existing = classFees.data?.find((cf) => cf.feeTypeId === ft.id);
                return (
                  <div key={ft.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{ft.name}</span>
                    <input
                      type="number"
                      min={0}
                      placeholder={existing ? String(existing.amount) : "amount"}
                      value={amounts[ft.id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [ft.id]: e.target.value }))}
                      style={{ width: 110 }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!amounts[ft.id] || saveAmount.isPending}
                      onClick={() => saveAmount.mutate(ft.id)}
                    >
                      Save
                    </Button>
                  </div>
                );
              })}
              {feeTypes.data?.length === 0 && (
                <p className="muted-cell" style={{ fontSize: 12 }}>
                  No fee types yet — add one above first.
                </p>
              )}
            </div>
          )}

          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
