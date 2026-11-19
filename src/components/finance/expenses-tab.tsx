import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import {
  createExpense,
  fetchExpense,
  fetchExpenses,
  recordExpensePayment,
  voidExpense,
  voidExpensePayment,
  type FeeStatus,
  type PaymentMethod,
} from "@/lib/finance-api";
import { ApiError } from "@/lib/api";
import { localDateString } from "@/lib/utils";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const statusTone: Record<FeeStatus, string> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };
const statusLabel: Record<FeeStatus, string> = { PAID: "Paid", PARTIAL: "Partially Paid", UNPAID: "Unpaid" };
const methodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  bkash: "bKash",
  nagad: "Nagad",
  other: "Other",
};

function AddExpenseDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateString());
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createExpense({ category, amount: parseInt(amount, 10), date, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense bill recorded");
      setOpen(false);
      setCategory("");
      setAmount("");
      setNote("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't record expense"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add expense
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
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
              Category
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Utilities"
              />
            </label>
            <label>
              Amount Due (৳)
              <input
                required
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>
          <label>
            Bill Date
            <DateInput required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Note <span className="muted-cell">(optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["expense", id], queryFn: () => fetchExpense(id) });
  const d = detail.data;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidAt, setPaidAt] = useState(localDateString());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (d) setAmount(String(d.remaining));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d?.remaining]);

  const pay = useMutation({
    mutationFn: () =>
      recordExpensePayment(id, {
        amount: parseInt(amount, 10),
        method,
        paidAt,
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Payment recorded");
      setNote("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't record payment"),
  });

  const voidPayment = useMutation({
    mutationFn: (paymentId: number) => {
      const reason = window.prompt("Reason for voiding this payment?");
      if (!reason || reason.trim().length < 3) throw new Error("cancelled");
      return voidExpensePayment(paymentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Payment voided");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't void payment");
    },
  });

  const voidWhole = useMutation({
    mutationFn: () => {
      const reason = window.prompt("Reason for voiding this expense bill?");
      if (!reason || reason.trim().length < 3) throw new Error("cancelled");
      return voidExpense(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense voided");
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't void expense");
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        {d && (
          <>
            <DialogHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 24 }}>
                <DialogTitle>Expense Bill Details</DialogTitle>
                <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>
              </div>
            </DialogHeader>
            <div>
              <strong style={{ fontSize: 16 }}>{d.category}</strong>
              <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 12 }}>
                Billed {d.date}
              </p>
            </div>
            <div className="two-fields" style={{ fontSize: 13, rowGap: 14 }}>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Amount Due
                </span>
                <strong>{money(d.amountDue)}</strong>
              </div>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Paid amount
                </span>
                <strong style={{ color: "var(--green)" }}>{money(d.paid)}</strong>
              </div>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Remaining due
                </span>
                <strong style={{ color: d.remaining > 0 ? "var(--red)" : undefined }}>
                  {money(d.remaining)}
                </strong>
              </div>
              {d.note && (
                <div>
                  <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                    Note
                  </span>
                  <strong>{d.note}</strong>
                </div>
              )}
            </div>

            <div>
              <p style={{ margin: "4px 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
                Payment History
              </p>
              {d.payments.length === 0 && (
                <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
                  No payments yet.
                </p>
              )}
              <div style={{ display: "grid", gap: 2 }}>
                {d.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      opacity: p.status === "voided" ? 0.5 : 1,
                    }}
                  >
                    <div>
                      <strong className="mono">{money(p.amount)}</strong>
                      <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 11 }}>
                        {p.paidAt} · {methodLabel[p.method]}
                      </p>
                    </div>
                    {p.status === "voided" ? (
                      <Badge tone="red">Voided</Badge>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge tone="green">Completed</Badge>
                        <Button size="sm" variant="ghost" onClick={() => voidPayment.mutate(p.id)}>
                          Void
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {d.remaining > 0 && (
              <form
                className="student-form"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  pay.mutate();
                }}
              >
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>Pay this bill</p>
                <label>
                  Payment amount
                  <input
                    required
                    type="number"
                    min={1}
                    max={d.remaining}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Payment method
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                      <label key={m} className={method === m ? "radio-option selected" : "radio-option"}>
                        <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                        {methodLabel[m]}
                      </label>
                    ))}
                  </div>
                </label>
                <label>
                  Payment date
                  <DateInput required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </label>
                <label>
                  Reference / Note <span className="muted-cell">(optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Transaction ID or payment note"
                  />
                </label>
                <Button type="submit" disabled={pay.isPending}>
                  {pay.isPending ? "Recording…" : "Confirm Payment"}
                </Button>
              </form>
            )}

            <div className="drawer-actions" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" variant="ghost" onClick={() => voidWhole.mutate()}>
                Void this bill
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExpensesTab() {
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const expenses = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () => fetchExpenses({ from, to }),
  });

  const total = expenses.data?.reduce((sum, e) => sum + e.amountDue, 0) ?? 0;

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
            From
            <DateInput value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <DateInput value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div style={{ flex: 1 }} />
          <AddExpenseDialog />
        </div>
      </Panel>

      <Panel>
        <div className="panel-title">
          <h2>Expenses</h2>
          <Badge tone="red">Total {money(total)}</Badge>
        </div>
        <DataTable
          headers={["DATE", "CATEGORY", "AMOUNT DUE", "STATUS", "NOTE", ""]}
          widths="1fr 1.2fr 1fr .9fr 1.4fr .9fr"
        >
          {expenses.isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
          {expenses.data?.length === 0 && (
            <EmptyRow colSpan={6}>No expenses in this period</EmptyRow>
          )}
          {expenses.data?.map((e) => (
            <tr key={e.id} onClick={() => setSelectedId(e.id)} style={{ cursor: "pointer" }}>
              <td className="mono">{e.date}</td>
              <td>{e.category}</td>
              <td className="mono">{money(e.amountDue)}</td>
              <td>
                <Badge tone={statusTone[e.status]}>{statusLabel[e.status]}</Badge>
              </td>
              <td className="muted-cell">{e.note ?? "—"}</td>
              <td>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(e.id);
                  }}
                >
                  View / Pay
                  <ArrowRight size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {selectedId !== null && (
        <ExpenseDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
