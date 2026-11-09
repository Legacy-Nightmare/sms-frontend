import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import { DateInput } from "@/components/ui/date-input";
import { fetchClasses } from "@/lib/academics-api";
import { fetchStudents, type StudentDto } from "@/lib/students-api";
import {
  bulkApplyStudentFee,
  createStudentFee,
  deleteStudentFee,
  fetchFeeTypes,
  fetchStudentFee,
  fetchStudentFees,
  recordStudentPayment,
  updateStudentFee,
  voidStudentPayment,
  type FeeStatus,
  type PaymentMethod,
  type StudentFeeDto,
} from "@/lib/finance-api";
import { ApiError } from "@/lib/api";
import { MONTHS, YEAR_OPTIONS } from "@/lib/month-year-options";
import { FeeTypeSettingsDialog } from "./fee-type-settings-dialog";
import { ReceiptDialog } from "./receipt-dialog";
import { AddStudentFeeDialog } from "./add-student-fee-dialog";

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
                  {c.name}
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
              <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)}>
                <option value="">No period (one-time)</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period year
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
                  <DateInput
                    required
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

// Metadata-only edit (amount/period/note) — never touches payments. Use the
// payment/void flow in StudentFeeDetailDialog to change how much has been
// paid.
function EditStudentFeeDialog({ fee, onClose }: { fee: StudentFeeDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amountDue, setAmountDue] = useState(String(fee.amountDue));
  const [periodMonth, setPeriodMonth] = useState(fee.periodMonth ? String(fee.periodMonth) : "");
  const [periodYear, setPeriodYear] = useState(fee.periodYear ? String(fee.periodYear) : "");
  const [note, setNote] = useState(fee.note ?? "");

  // The year dropdown is normally just the fixed 10-year range, but if this
  // fee already has an out-of-range year (bad data entered before this was
  // a dropdown), that value is added in so it still shows up and can be
  // corrected rather than silently disappearing.
  const yearOptions =
    fee.periodYear && !YEAR_OPTIONS.includes(fee.periodYear)
      ? [...YEAR_OPTIONS, fee.periodYear].sort((a, b) => a - b)
      : YEAR_OPTIONS;

  const mutation = useMutation({
    mutationFn: () =>
      updateStudentFee(fee.id, {
        amountDue: parseInt(amountDue, 10),
        periodMonth: periodMonth ? parseInt(periodMonth, 10) : null,
        periodYear: periodYear ? parseInt(periodYear, 10) : null,
        note: note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      queryClient.invalidateQueries({ queryKey: ["student-fee", fee.id] });
      toast.success("Fee updated");
      onClose();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update fee"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit fee — {fee.studentName} ({fee.feeTypeName})
          </DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Amount due (৳)
            <input
              required
              type="number"
              min={0}
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
            />
          </label>
          <div className="two-fields">
            <label>
              Period month <span className="muted-cell">(optional)</span>
              <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)}>
                <option value="">No period (one-time)</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period year
              <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)}>
                <option value="">Select year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
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

// Shared across both fee tables — a fee that's never had a payment can be
// hard-deleted; one that has must be voided first (the backend enforces
// this and returns a 409, surfaced here as a toast).
function useDeleteStudentFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fee: StudentFeeDto) => {
      const ok = window.confirm(
        `Delete the ${fee.feeTypeName} fee for ${fee.studentName}? This cannot be undone.`,
      );
      if (!ok) throw new Error("cancelled");
      return deleteStudentFee(fee.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Fee deleted");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete fee");
    },
  });
}

// Status isn't a stored column — it's derived from payments — so "setting"
// it here means performing the underlying payment action: PAID pays off
// whatever remains, UNPAID voids every active payment (reverting to zero
// paid), and PARTIAL prompts for how much of the remaining amount to record
// as paid now. Picking the fee's current status is a no-op.
function useQuickSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fee, newStatus }: { fee: StudentFeeDto; newStatus: FeeStatus }) => {
      if (newStatus === fee.status) return;
      const today = new Date().toISOString().slice(0, 10);

      if (newStatus === "PAID") {
        if (fee.remaining > 0) {
          await recordStudentPayment(fee.id, { amount: fee.remaining, method: "cash", paidAt: today });
        }
      } else if (newStatus === "UNPAID") {
        const detail = await fetchStudentFee(fee.id);
        await Promise.all(
          detail.payments
            .filter((p) => p.status === "active")
            .map((p) => voidStudentPayment(p.id, "Reset to unpaid")),
        );
      } else {
        const input = window.prompt(`Amount received now (of ৳${fee.remaining} remaining)?`);
        if (!input) throw new Error("cancelled");
        const amount = parseInt(input, 10);
        if (!amount || amount <= 0 || amount >= fee.remaining) {
          throw new Error("Enter an amount less than the remaining due");
        }
        await recordStudentPayment(fee.id, { amount, method: "cash", paidAt: today });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "cancelled") return;
      toast.error(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Couldn't update status",
      );
    },
  });
}

function StatusSelect({
  fee,
  onChange,
}: {
  fee: StudentFeeDto;
  onChange: (fee: StudentFeeDto, newStatus: FeeStatus) => void;
}) {
  return (
    <select
      value={fee.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(fee, e.target.value as FeeStatus)}
      style={{ height: 30, fontSize: 12, padding: "0 8px" }}
    >
      <option value="PAID">Paid</option>
      <option value="PARTIAL">Partial paid</option>
      <option value="UNPAID">Unpaid</option>
    </select>
  );
}

// All fees billed for one student (across every fee type/period), with a
// row-click into the same payment/receipt dialog used by the "All billed
// fees" view below.
function StudentFeesListDialog({ student, onClose }: { student: StudentDto; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingFee, setEditingFee] = useState<StudentFeeDto | null>(null);
  const deleteFee = useDeleteStudentFee();
  const setStatus = useQuickSetStatus();
  const fees = useQuery({
    queryKey: ["student-fees", "by-student", student.id],
    queryFn: () => fetchStudentFees({ studentId: student.id, pageSize: 200 }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 820 }}>
        <DialogHeader>
          <DialogTitle>
            Fees — {student.name} <span className="muted-cell mono">({student.code})</span>
          </DialogTitle>
        </DialogHeader>
        <DataTable
          headers={["FEE TYPE", "PERIOD", "DUE", "REMAINING", "STATUS", "ACTIONS"]}
          widths="1.2fr .8fr .9fr .9fr .8fr 1fr"
        >
          {fees.isLoading && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
          {fees.data?.rows.length === 0 && <EmptyRow colSpan={6}>No fees billed yet</EmptyRow>}
          {fees.data?.rows.map((f) => (
            <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(f.id)}>
              <td>{f.feeTypeName}</td>
              <td className="mono muted-cell">
                {f.periodMonth ? `${f.periodMonth}/${f.periodYear}` : "—"}
              </td>
              <td className="mono">{money(f.amountDue)}</td>
              <td className="mono strong">{money(f.remaining)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <StatusSelect fee={f} onChange={(fee, newStatus) => setStatus.mutate({ fee, newStatus })} />
              </td>
              <td style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => setEditingFee(f)}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteFee.mutate(f)}>
                  <Trash2 size={13} />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </DialogContent>
      {selectedId && <StudentFeeDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
      {editingFee && <EditStudentFeeDialog fee={editingFee} onClose={() => setEditingFee(null)} />}
    </Dialog>
  );
}

// Default view: every student, filterable by class/section/search, each with
// an "Add fee" action that bills the fixed set of fee fields in one go.
function StudentsView() {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [feeStudent, setFeeStudent] = useState<StudentDto | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentDto | null>(null);

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const students = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });

  const availableSections = useMemo(() => {
    if (!classes.data) return [];
    if (classId === "") return classes.data.flatMap((c) => c.sections);
    return classes.data.find((c) => c.id === classId)?.sections ?? [];
  }, [classes.data, classId]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (students.data ?? []).filter((s) => {
      if (query && !s.name.toLowerCase().includes(query) && !s.code.toLowerCase().includes(query)) {
        return false;
      }
      if (classId !== "" && s.classId !== classId) return false;
      if (sectionId !== "" && s.sectionId !== sectionId) return false;
      return true;
    });
  }, [students.data, search, classId, sectionId]);

  return (
    <>
      <Panel>
        <div className="exam-filters">
          <div className="search-input">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
            />
          </div>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value ? parseInt(e.target.value, 10) : "");
              setSectionId("");
            }}
          >
            <option value="">All classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value ? parseInt(e.target.value, 10) : "")}
          >
            <option value="">All sections</option>
            {availableSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          headers={["STUDENT", "CLASS", "SECTION", "ROLL", "ACTIONS"]}
          widths="1.6fr 1fr 1fr .6fr 1.4fr"
        >
          {students.isLoading && <EmptyRow colSpan={5}>Loading students…</EmptyRow>}
          {!students.isLoading && filteredStudents.length === 0 && (
            <EmptyRow colSpan={5}>No students match your filters.</EmptyRow>
          )}
          {filteredStudents.map((s) => (
            <tr key={s.id}>
              <td>
                {s.name} <span className="muted-cell mono">({s.code})</span>
              </td>
              <td>{s.classEntity.name}</td>
              <td>{s.section.name}</td>
              <td className="mono">{s.roll}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <Button size="sm" onClick={() => setFeeStudent(s)}>
                  Add fee
                </Button>
                <Button size="sm" variant="outline" onClick={() => setViewingStudent(s)}>
                  View fees
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {feeStudent && <AddStudentFeeDialog student={feeStudent} onClose={() => setFeeStudent(null)} />}
      {viewingStudent && (
        <StudentFeesListDialog student={viewingStudent} onClose={() => setViewingStudent(null)} />
      )}
    </>
  );
}

// All billed fees across every student, filterable by class/status — the
// original view, kept for bulk-billing a whole class and for an overview of
// everything billed regardless of which student it's for.
function AllBilledFeesView() {
  const [classId, setClassId] = useState<number | "">("");
  const [status, setStatus] = useState<FeeStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingFee, setEditingFee] = useState<StudentFeeDto | null>(null);
  const deleteFee = useDeleteStudentFee();
  const setFeeStatus = useQuickSetStatus();

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
                  {c.name}
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
          headers={["STUDENT", "CLASS", "FEE TYPE", "PERIOD", "DUE", "REMAINING", "STATUS", "ACTIONS"]}
          widths="1.3fr .7fr 1fr .8fr .9fr .9fr .8fr .9fr"
        >
          {fees.isLoading && <EmptyRow colSpan={8}>Loading…</EmptyRow>}
          {fees.data?.rows.length === 0 && <EmptyRow colSpan={8}>No fees billed yet</EmptyRow>}
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
              <td onClick={(e) => e.stopPropagation()}>
                <StatusSelect fee={f} onChange={(fee, newStatus) => setFeeStatus.mutate({ fee, newStatus })} />
              </td>
              <td style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => setEditingFee(f)}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteFee.mutate(f)}>
                  <Trash2 size={13} />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {selectedId && <StudentFeeDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
      {editingFee && <EditStudentFeeDialog fee={editingFee} onClose={() => setEditingFee(null)} />}
    </>
  );
}

export function StudentFeesTab() {
  const [view, setView] = useState<"students" | "billed">("students");

  return (
    <>
      <div className="mode-toggle" style={{ width: 320, marginBottom: 16 }}>
        <button
          type="button"
          className={view === "students" ? "active" : ""}
          onClick={() => setView("students")}
        >
          Students
        </button>
        <button
          type="button"
          className={view === "billed" ? "active" : ""}
          onClick={() => setView("billed")}
        >
          All billed fees
        </button>
      </div>
      {view === "students" ? <StudentsView /> : <AllBilledFeesView />}
    </>
  );
}
