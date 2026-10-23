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
import { fetchClasses } from "@/lib/academics-api";
import { fetchStudents } from "@/lib/students-api";
import {
  bulkApplyStudentFee,
  createStudentFee,
  fetchFeeTypes,
  fetchStudentFee,
  fetchStudentFees,
  recordStudentPayment,
  voidStudentPayment,
  type FeeStatus,
  type PaymentMethod,
  type StudentFeeDto,
} from "@/lib/finance-api";
import { ApiError } from "@/lib/api";
import { FeeTypeSettingsDialog } from "./fee-type-settings-dialog";
import { ReceiptDialog } from "./receipt-dialog";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const statusTone: Record<FeeStatus, string> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };

function BillFeeDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const feeTypes = useQuery({ queryKey: ["fee-types"], queryFn: fetchFeeTypes });
  const students = useQuery({
    queryKey: ["students", classId],
    queryFn: () => fetchStudents({ classId: parseInt(classId, 10) }),
    enabled: mode === "student" && !!classId,
  });

  const reset = () => {
    setClassId("");
    setStudentId("");
    setFeeTypeId("");
    setAmount("");
    setPeriodMonth("");
    setPeriodYear("");
  };

  const mutation = useMutation({
    mutationFn: (): Promise<{ created: number; skipped: number } | StudentFeeDto> => {
      const period = {
        periodMonth: periodMonth ? parseInt(periodMonth, 10) : undefined,
        periodYear: periodYear ? parseInt(periodYear, 10) : undefined,
      };
      if (mode === "class") {
        return bulkApplyStudentFee({
          classId: parseInt(classId, 10),
          feeTypeId: parseInt(feeTypeId, 10),
          amount: parseInt(amount, 10),
          ...period,
        });
      }
      return createStudentFee({
        studentId: parseInt(studentId, 10),
        feeTypeId: parseInt(feeTypeId, 10),
        amountDue: parseInt(amount, 10),
        ...period,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      if ("created" in res) {
        toast.success(
          `Billed ${res.created} student(s)${res.skipped ? `, skipped ${res.skipped} already billed` : ""}`,
        );
      } else {
        toast.success("Fee added");
      }
      setOpen(false);
      reset();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't add fee"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Bill a fee
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bill a fee</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === "class" ? "active" : ""}
              onClick={() => setMode("class")}
            >
              Whole class
            </button>
            <button
              type="button"
              className={mode === "student" ? "active" : ""}
              onClick={() => setMode("student")}
            >
              One student
            </button>
          </div>
          <label>
            Class
            <select required value={classId} onChange={(e) => setClassId(e.target.value)}>
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
          {mode === "student" && (
            <label>
              Student
              <select required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="" disabled>
                  Select student
                </option>
                {students.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="two-fields">
            <label>
              Fee type
              <select required value={feeTypeId} onChange={(e) => setFeeTypeId(e.target.value)}>
                <option value="" disabled>
                  Select fee type
                </option>
                {feeTypes.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
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
          <div className="two-fields">
            <label>
              Period month <span className="muted-cell">(optional, for recurring)</span>
              <input
                type="number"
                min={1}
                max={12}
                placeholder="e.g. 10"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              />
            </label>
            <label>
              Period year
              <input
                type="number"
                placeholder="e.g. 2026"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
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
              {mutation.isPending ? "Saving…" : "Bill fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentFeeDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["student-fee", id], queryFn: () => fetchStudentFee(id) });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);

  const pay = useMutation({
    mutationFn: () =>
      recordStudentPayment(id, {
        amount: parseInt(amount, 10),
        method,
        paidAt,
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fee", id] });
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
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
      return voidStudentPayment(paymentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fee", id] });
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
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
            {detail.data?.studentName} — {detail.data?.feeTypeName}
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
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. 2nd installment"
                  />
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
                widths="1fr 1fr 1fr 1.3fr 1.3fr"
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
                    <td style={{ display: "flex", gap: 6 }}>
                      {p.status === "voided" ? (
                        <Badge tone="red">Voided</Badge>
                      ) : (
                        <>
                          {p.receiptNumber && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReceiptPaymentId(p.id)}
                            >
                              Receipt
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => voidPayment.mutate(p.id)}
                          >
                            Void
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </div>
        )}
      </DialogContent>
      {detail.data &&
        receiptPaymentId &&
        (() => {
          const payment = detail.data.payments.find((p) => p.id === receiptPaymentId);
          return payment ? (
            <ReceiptDialog
              payment={payment}
              fee={detail.data}
              onClose={() => setReceiptPaymentId(null)}
            />
          ) : null;
        })()}
    </Dialog>
  );
}

export function StudentFeesTab() {
  const [classId, setClassId] = useState<number | "">("");
  const [status, setStatus] = useState<FeeStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const fees = useQuery({
    queryKey: ["student-fees", classId, status],
    queryFn: () =>
      fetchStudentFees({
        classId: classId === "" ? undefined : classId,
        status: status === "" ? undefined : status,
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
          <label style={{ minWidth: 160 }}>
            Class
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value ? parseInt(e.target.value, 10) : "")}
            >
              <option value="">All classes</option>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Class {c.level}
                </option>
              ))}
            </select>
          </label>
          <label style={{ minWidth: 160 }}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as FeeStatus | "")}>
              <option value="">All statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
          <div style={{ flex: 1 }} />
          <FeeTypeSettingsDialog />
          <BillFeeDialog />
        </div>
      </Panel>

      <Panel>
        <DataTable
          headers={["STUDENT", "CLASS", "FEE TYPE", "PERIOD", "DUE", "REMAINING", "STATUS"]}
          widths="1.4fr .8fr 1.1fr .9fr 1fr 1fr .9fr"
        >
          {fees.isLoading && <EmptyRow colSpan={7}>Loading…</EmptyRow>}
          {fees.data?.rows.length === 0 && <EmptyRow colSpan={7}>No fees billed yet</EmptyRow>}
          {fees.data?.rows.map((f) => (
            <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(f.id)}>
              <td>
                {f.studentName} <span className="muted-cell mono">({f.studentCode})</span>
              </td>
              <td>{f.className}</td>
              <td>{f.feeTypeName}</td>
              <td className="mono muted-cell">
                {f.periodMonth ? `${f.periodMonth}/${f.periodYear}` : "—"}
              </td>
              <td className="mono">{money(f.amountDue)}</td>
              <td className="mono strong">{money(f.remaining)}</td>
              <td>
                <Badge tone={statusTone[f.status]}>{f.status}</Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {selectedId && <StudentFeeDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
