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
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import {
  bulkGenerateSalary,
  fetchTeacherSalaries,
  fetchTeacherSalary,
  fetchTeachers,
  recordSalaryPayment,
  voidSalaryPayment,
  type FeeStatus,
  type PaymentMethod,
} from "@/lib/finance-api";
import { ApiError } from "@/lib/api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const statusTone: Record<FeeStatus, string> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };
const now = new Date();

function GenerateSalaryDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amountDue, setAmountDue] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);

  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers, enabled: open });

  const mutation = useMutation({
    mutationFn: () =>
      bulkGenerateSalary({
        teacherIds: selectedTeacherIds.length
          ? selectedTeacherIds
          : (teachers.data ?? []).map((t) => t.id),
        amountDue: parseInt(amountDue, 10),
        periodMonth: parseInt(periodMonth, 10),
        periodYear: parseInt(periodYear, 10),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success(
        `Generated ${res.created} salary record(s)${res.skipped ? `, skipped ${res.skipped} already set` : ""}`,
      );
      setOpen(false);
      setAmountDue("");
      setSelectedTeacherIds([]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate salary"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Generate salary
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate monthly salary</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="two-fields">
            <label>
              Month
              <input
                required
                type="number"
                min={1}
                max={12}
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              />
            </label>
            <label>
              Year
              <input
                required
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
              />
            </label>
          </div>
          <label>
            Amount per teacher (৳)
            <input
              required
              type="number"
              min={1}
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
            />
          </label>
          <label>
            Teachers <span className="muted-cell">(none selected = all teachers)</span>
            <div
              style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto", marginTop: 6 }}
            >
              {teachers.data?.map((t) => (
                <label
                  key={t.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={selectedTeacherIds.includes(t.id)}
                    onChange={(e) =>
                      setSelectedTeacherIds((prev) =>
                        e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                      )
                    }
                  />
                  {t.name}
                </label>
              ))}
              {teachers.data?.length === 0 && (
                <p className="muted-cell">No teacher accounts yet.</p>
              )}
            </div>
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SalaryDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["teacher-salary", id],
    queryFn: () => fetchTeacherSalary(id),
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const pay = useMutation({
    mutationFn: () =>
      recordSalaryPayment(id, {
        amount: parseInt(amount, 10),
        method,
        paidAt,
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salary", id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success("Payment recorded");
      setAmount("");
      setNote("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't record payment"),
  });

  const voidPayment = useMutation({
    mutationFn: (paymentId: number) => {
      const reason = window.prompt("Reason for voiding this payment?");
      if (!reason || reason.trim().length < 3) throw new Error("cancelled");
      return voidSalaryPayment(paymentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salary", id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success("Payment voided");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't void payment");
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {detail.data?.teacherName} — {detail.data?.periodMonth}/{detail.data?.periodYear}
          </DialogTitle>
        </DialogHeader>
        {detail.data && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span>
                Due: <strong className="mono">{money(detail.data.amountDue)}</strong>
              </span>
              <span>
                Paid: <strong className="mono">{money(detail.data.paid)}</strong>
              </span>
              <span>
                Remaining: <strong className="mono">{money(detail.data.remaining)}</strong>
              </span>
              <Badge tone={statusTone[detail.data.status]}>{detail.data.status}</Badge>
            </div>

            {detail.data.remaining > 0 && (
              <form
                className="two-fields"
                style={{ alignItems: "flex-end" }}
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  pay.mutate();
                }}
              >
                <label>
                  Amount (৳)
                  <input
                    required
                    type="number"
                    min={1}
                    max={detail.data.remaining}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Method
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </label>
                <label>
                  Note <span className="muted-cell">(optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <Button type="submit" disabled={pay.isPending} style={{ gridColumn: "1 / -1" }}>
                  {pay.isPending ? "Recording…" : "Record payment"}
                </Button>
              </form>
            )}

            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted-foreground)",
                }}
              >
                Payment history
              </p>
              <DataTable
                headers={["DATE", "AMOUNT", "METHOD", "RECEIPT", ""]}
                widths="1fr 1fr 1fr 1.3fr .8fr"
              >
                {detail.data.payments.length === 0 && (
                  <EmptyRow colSpan={5}>No payments yet</EmptyRow>
                )}
                {detail.data.payments.map((p) => (
                  <tr key={p.id} style={{ opacity: p.status === "voided" ? 0.5 : 1 }}>
                    <td className="mono">{p.paidAt}</td>
                    <td className="mono">{money(p.amount)}</td>
                    <td>{p.method}</td>
                    <td className="mono muted-cell">{p.receiptNumber}</td>
                    <td>
                      {p.status === "voided" ? (
                        <Badge tone="red">Voided</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => voidPayment.mutate(p.id)}>
                          Void
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TeacherSalaryTab() {
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const salaries = useQuery({
    queryKey: ["teacher-salaries", periodMonth, periodYear],
    queryFn: () =>
      fetchTeacherSalaries({
        periodMonth: parseInt(periodMonth, 10),
        periodYear: parseInt(periodYear, 10),
      }),
  });

  return (
    <>
      <Panel>
        <div
          style={{
            padding: 16,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <label>
            Month
            <input
              type="number"
              min={1}
              max={12}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
          <label>
            Year
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(e.target.value)}
              style={{ width: 100 }}
            />
          </label>
          <div style={{ flex: 1 }} />
          <GenerateSalaryDialog />
        </div>
      </Panel>

      <Panel>
        <DataTable
          headers={["TEACHER", "PERIOD", "DUE", "PAID", "REMAINING", "STATUS"]}
          widths="1.6fr 1fr 1fr 1fr 1fr 1fr"
        >
          {salaries.isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
          {salaries.data?.rows.length === 0 && (
            <EmptyRow colSpan={6}>No salary records for this month yet</EmptyRow>
          )}
          {salaries.data?.rows.map((s) => (
            <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(s.id)}>
              <td>{s.teacherName}</td>
              <td className="mono muted-cell">
                {s.periodMonth}/{s.periodYear}
              </td>
              <td className="mono">{money(s.amountDue)}</td>
              <td className="mono muted-cell">{money(s.paid)}</td>
              <td className="mono strong">{money(s.remaining)}</td>
              <td>
                <Badge tone={statusTone[s.status]}>{s.status}</Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {selectedId && <SalaryDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
