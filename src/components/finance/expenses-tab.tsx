import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import { createExpense, fetchExpenses, voidExpense } from "@/lib/finance-api";
import { ApiError } from "@/lib/api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

function AddExpenseDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createExpense({ category, amount: parseInt(amount, 10), date, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded");
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
              Amount (৳)
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
            Date
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

export function ExpensesTab() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const expenses = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: () => fetchExpenses({ from, to }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: number) => {
      const reason = window.prompt("Reason for voiding this expense?");
      if (!reason || reason.trim().length < 3) throw new Error("cancelled");
      return voidExpense(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense voided");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't void expense");
    },
  });

  const total = expenses.data?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

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
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
          headers={["DATE", "CATEGORY", "AMOUNT", "NOTE", ""]}
          widths="1fr 1.2fr 1fr 1.6fr .8fr"
        >
          {expenses.isLoading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
          {expenses.data?.length === 0 && (
            <EmptyRow colSpan={5}>No expenses in this period</EmptyRow>
          )}
          {expenses.data?.map((e) => (
            <tr key={e.id}>
              <td className="mono">{e.date}</td>
              <td>{e.category}</td>
              <td className="mono">{money(e.amount)}</td>
              <td className="muted-cell">{e.note ?? "—"}</td>
              <td>
                <Button size="sm" variant="ghost" onClick={() => voidMutation.mutate(e.id)}>
                  Void
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
