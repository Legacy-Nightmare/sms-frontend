import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { createMultiStudentFee, recordStudentPayment } from "@/lib/finance-api";
import { ApiError } from "@/lib/api";
import type { StudentDto } from "@/lib/students-api";
import { MONTHS, YEAR_OPTIONS } from "@/lib/month-year-options";

// The fixed set of fees a student is commonly billed for. `feeTypeName` is
// the canonical FeeType name stored in the DB (resolved/created on the fly
// by the backend) — kept slightly more formal than some of the on-screen
// labels (e.g. "Regi. Fee" -> "Registration Fee") so reports read cleanly.
const FEE_FIELDS = [
  { key: "admission", label: "Admission Fee", feeTypeName: "Admission Fee" },
  { key: "session", label: "Session Fee", feeTypeName: "Session Fee" },
  { key: "fee", label: "Fee", feeTypeName: "Fee" },
  { key: "exam", label: "Exam Fee", feeTypeName: "Exam Fee" },
  { key: "regi", label: "Regi. Fee", feeTypeName: "Registration Fee" },
  { key: "specialClass", label: "Special Class Fee", feeTypeName: "Special Class Fee" },
  { key: "improvement", label: "Improvement Fee", feeTypeName: "Improvement Fee" },
  { key: "others", label: "Others", feeTypeName: "Others" },
] as const;

type PaymentStatus = "paid" | "partial" | "unpaid";

// A dropdown of months that can have more than one selected at once — e.g.
// backdating recurring "Fee" for Sept+Oct+Nov in a single submission. Built
// from the same primitives (Popover + Checkbox) the rest of the app's UI
// kit already ships, rather than a plain <select multiple>, which has poor
// discoverability and an inconsistent native look across browsers.
function MonthMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (months: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (month: number) => {
    onChange(
      value.includes(month)
        ? value.filter((m) => m !== month)
        : [...value, month].sort((a, b) => a - b),
    );
  };

  const label =
    value.length === 0
      ? "No months (one-time)"
      : value.length <= 2
        ? value.map((m) => (MONTHS[m - 1] ?? "").slice(0, 3)).join(", ")
        : `${value.length} months selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            width: "100%",
            height: 35,
            border: "1px solid var(--input)",
            borderRadius: 7,
            background: "transparent",
            color: value.length === 0 ? "var(--muted-foreground)" : "var(--foreground)",
            padding: "0 13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {label}
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 200, padding: 8 }}>
        <div style={{ display: "grid", gap: 2, maxHeight: 260, overflowY: "auto" }}>
          {MONTHS.map((name, i) => {
            const month = i + 1;
            return (
              <label
                key={month}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  padding: "6px 4px",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                <Checkbox
                  checked={value.includes(month)}
                  onCheckedChange={() => toggle(month)}
                />
                {name}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AddStudentFeeDialog({
  student,
  onClose,
}: {
  student: StudentDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [months, setMonths] = useState<number[]>([]);
  const [periodYear, setPeriodYear] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("paid");
  const [partialAmount, setPartialAmount] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const fees = FEE_FIELDS.filter((f) => (amounts[f.key] ?? "").trim() !== "").map((f) => ({
        name: f.feeTypeName,
        amount: parseInt(amounts[f.key] ?? "", 10),
      }));
      const year = periodYear ? parseInt(periodYear, 10) : undefined;

      // No month selected: one-time fee(s), billed once with no period.
      // One or more months selected: bill the same fee(s) once per month
      // (e.g. recurring "Fee" for several months at once).
      const periods = months.length > 0 ? months : [undefined];
      const results = await Promise.all(
        periods.map((month) =>
          createMultiStudentFee({
            studentId: student.id,
            periodMonth: month,
            periodYear: month ? year : undefined,
            note: note || undefined,
            fees,
          }),
        ),
      );

      const { created, skipped } = results.reduce(
        (acc, r, i) => ({
          created: [...acc.created, ...r.created],
          skipped: [
            ...acc.skipped,
            ...r.skipped.map((name) =>
              months.length > 0
                ? `${name} (${(MONTHS[periods[i]! - 1] ?? "").slice(0, 3)})`
                : name,
            ),
          ],
        }),
        { created: [] as Array<{ id: number; name: string; amount: number }>, skipped: [] as string[] },
      );

      const today = new Date().toISOString().slice(0, 10);
      if (status === "paid") {
        await Promise.all(
          created.map((c) =>
            recordStudentPayment(c.id, { amount: c.amount, method: "cash", paidAt: today }),
          ),
        );
      } else if (status === "partial" && created.length === 1 && created[0]) {
        await recordStudentPayment(created[0].id, {
          amount: parseInt(partialAmount, 10),
          method: "cash",
          paidAt: today,
        });
      }

      return { created: created.length, skipped };
    },
    onSuccess: ({ created, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success(
        `Billed ${created} fee(s) for ${student.name}` +
          (skipped.length ? ` — already billed: ${skipped.join(", ")}` : ""),
      );
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't add fees"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>
            Add fee — {student.name} <span className="muted-cell mono">({student.code})</span>
          </DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const filled = FEE_FIELDS.filter((f) => (amounts[f.key] ?? "").trim() !== "");
            if (filled.length === 0) {
              toast.error("Enter an amount for at least one fee");
              return;
            }
            if (months.length > 0 && !periodYear) {
              toast.error("Select a year for the selected month(s)");
              return;
            }
            if (status === "partial") {
              const rowCount = filled.length * Math.max(months.length, 1);
              if (rowCount !== 1) {
                toast.error(
                  "Partial paid only works when billing a single fee for a single month — use Paid or Unpaid for several at once",
                );
                return;
              }
              const partial = parseInt(partialAmount, 10);
              const total = parseInt(amounts[filled[0]!.key] ?? "", 10);
              if (!partial || partial <= 0 || partial >= total) {
                toast.error("Enter an amount received that's less than the total due");
                return;
              }
            }
            mutation.mutate();
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {FEE_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label} (৳)
                <input
                  type="number"
                  min={1}
                  value={amounts[f.key] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder="0"
                />
              </label>
            ))}
          </div>
          <div className="two-fields">
            <label>
              Months
              <MonthMultiSelect value={months} onChange={setMonths} />
            </label>
            <label>
              Year
              <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)}>
                <option value="">Select year</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p style={{ margin: "-10px 0 0", color: "var(--muted-foreground)", fontSize: 12 }}>
            Leave months empty for a one-time fee; select one or more months to bill a recurring
            fee for each of them.
          </p>
          <div className="two-fields">
            <label>
              Payment status
              <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
                <option value="paid">Paid</option>
                <option value="partial">Partial paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            {status === "partial" && (
              <label>
                Amount received now (৳)
                <input
                  type="number"
                  min={1}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="e.g. 2000"
                />
              </label>
            )}
          </div>
          <label>
            Note <span className="muted-cell">(optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. new admission" />
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Add fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
