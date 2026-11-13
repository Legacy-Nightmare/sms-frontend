import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import { DateInput } from "@/components/ui/date-input";
import { fetchClasses } from "@/lib/academics-api";
import { fetchStudents } from "@/lib/students-api";
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
  type PaymentDto,
  type PaymentMethod,
  type StudentFeeDto,
} from "@/lib/finance-api";
import { ApiError } from "@/lib/api";
import { exportStyledExcel } from "@/lib/excel-export";
import { localDateString } from "@/lib/utils";
import { MONTHS, YEAR_OPTIONS } from "@/lib/month-year-options";
import { PrintableSheet } from "@/components/printable-sheet";
import { fetchSchoolProfile } from "@/lib/website-api";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
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
  const [paidAt, setPaidAt] = useState(localDateString());
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
      <DialogContent style={{ maxWidth: 680 }}>
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
// paid). PARTIAL needs an amount from the user, so that case is handled by
// PartialPaymentDialog instead of this hook. Picking the fee's current
// status is a no-op.
function useQuickSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fee, newStatus }: { fee: StudentFeeDto; newStatus: "PAID" | "UNPAID" }) => {
      if (newStatus === fee.status) return;
      const today = localDateString();

      if (newStatus === "PAID") {
        if (fee.remaining > 0) {
          await recordStudentPayment(fee.id, { amount: fee.remaining, method: "cash", paidAt: today });
        }
      } else {
        const detail = await fetchStudentFee(fee.id);
        await Promise.all(
          detail.payments
            .filter((p) => p.status === "active")
            .map((p) => voidStudentPayment(p.id, "Reset to unpaid")),
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update status");
    },
  });
}

// Replaces a native window.prompt() for "how much came in now" — same
// validation (must be a positive amount less than what's remaining, since
// a full payment should go through the PAID status instead).
function PartialPaymentDialog({ fee, onClose }: { fee: StudentFeeDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordStudentPayment(fee.id, {
        amount: parseInt(amount, 10),
        method: "cash",
        paidAt: localDateString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Payment recorded");
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't record payment"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Partial payment — {fee.studentName} <span className="muted-cell mono">({fee.feeTypeName})</span>
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
            Amount received now (৳){" "}
            <span className="muted-cell">(of {money(fee.remaining)} remaining)</span>
            <input
              required
              autoFocus
              type="number"
              min={1}
              max={Math.max(fee.remaining - 1, 1)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Less than ${fee.remaining}`}
            />
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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
      className={`status-select status-select-${statusTone[fee.status]}`}
      style={{ height: 30, fontSize: 12, padding: "0 8px" }}
    >
      <option value="PAID">Paid</option>
      <option value="PARTIAL">Partial paid</option>
      <option value="UNPAID">Unpaid</option>
    </select>
  );
}

function startOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface FeeFilters {
  classId: number | "";
  sectionId: number | "";
  feeTypeId: number | "";
  status: FeeStatus | "";
  from: string;
  to: string;
  search: string;
}

function defaultFilters(): FeeFilters {
  return {
    classId: "",
    sectionId: "",
    feeTypeId: "",
    status: "",
    from: startOfMonthStr(),
    to: localDateString(),
    search: "",
  };
}

const PAGE_SIZE = 20;

// Unified view: every billed student fee in one table (replaces the old
// "Students" / "All billed fees" toggle), with a summary that reflects
// whatever filters are currently applied. Billing a fee for a student who
// has none yet still goes through "Bill a fee" below — there's no need for
// a separate student-browsing tab just to reach that.
export function StudentFeesTab() {
  const [filters, setFilters] = useState<FeeFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingFee, setEditingFee] = useState<StudentFeeDto | null>(null);
  const [partialPayFee, setPartialPayFee] = useState<StudentFeeDto | null>(null);
  const [receipt, setReceipt] = useState<{
    payment: PaymentDto;
    fee: StudentFeeDto;
    autoPrint: boolean;
  } | null>(null);

  const deleteFee = useDeleteStudentFee();
  const setFeeStatus = useQuickSetStatus();

  const handleStatusChange = (fee: StudentFeeDto, newStatus: FeeStatus) => {
    if (newStatus === "PARTIAL") {
      if (newStatus !== fee.status) setPartialPayFee(fee);
      return;
    }
    setFeeStatus.mutate({ fee, newStatus });
  };

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const feeTypes = useQuery({ queryKey: ["fee-types"], queryFn: fetchFeeTypes });

  const availableSections = useMemo(() => {
    if (!classes.data) return [];
    if (filters.classId === "") return classes.data.flatMap((c) => c.sections);
    return classes.data.find((c) => c.id === filters.classId)?.sections ?? [];
  }, [classes.data, filters.classId]);

  const fees = useQuery({
    queryKey: ["student-fees", filters, page],
    queryFn: () =>
      fetchStudentFees({
        classId: filters.classId === "" ? undefined : filters.classId,
        sectionId: filters.sectionId === "" ? undefined : filters.sectionId,
        feeTypeId: filters.feeTypeId === "" ? undefined : filters.feeTypeId,
        status: filters.status === "" ? undefined : filters.status,
        search: filters.search.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const feeRows = fees.data?.rows ?? [];
  const total = fees.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = fees.data?.summary ?? { totalBilled: 0, collected: 0, outstanding: 0 };

  // Every filter applies immediately on change — the patch merges into
  // filters (which drives the query key above) and jumps back to page 1,
  // since the old page number is almost never still valid for a new filter.
  const updateFilters = (patch: Partial<FeeFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(defaultFilters());
    setPage(1);
  };

  // Row actions need the fee's payments, which the list row doesn't carry —
  // fetched on demand rather than per-row on every render.
  const openReceipt = async (row: StudentFeeDto) => {
    if (row.paid <= 0) {
      toast.error("No payments recorded against this fee yet");
      return;
    }
    try {
      const detail = await fetchStudentFee(row.id);
      const latest = detail.payments.find((p) => p.status === "active");
      if (!latest) {
        toast.error("No active payment found for this fee");
        return;
      }
      setReceipt({ payment: latest, fee: detail, autoPrint: true });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't load the receipt");
    }
  };

  // "Download" is a real file, not a dialog — fetch the same data the
  // dialog would, and hand it straight to the PDF generator.
  const downloadReceipt = async (row: StudentFeeDto) => {
    if (row.paid <= 0) {
      toast.error("No payments recorded against this fee yet");
      return;
    }
    try {
      const [detail, profile] = await Promise.all([
        fetchStudentFee(row.id),
        fetchSchoolProfile(),
      ]);
      const latest = detail.payments.find((p) => p.status === "active");
      if (!latest) {
        toast.error("No active payment found for this fee");
        return;
      }
      downloadReceiptPdf(latest, detail, profile.phone);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate the receipt");
    }
  };

  const exportColumns = [
    { header: "Student", key: "student" },
    { header: "Class / Section", key: "classSection" },
    { header: "Fee type", key: "feeType" },
    { header: "Period", key: "period" },
    { header: "Billed", key: "billed", type: "currency" as const },
    { header: "Paid", key: "paid", type: "currency" as const },
    { header: "Remaining", key: "remaining", type: "currency" as const },
    { header: "Status", key: "status" },
  ];
  const exportRows = feeRows.map((f) => ({
    student: `${f.studentName} (${f.studentCode})`,
    classSection: `${f.className} · ${f.sectionName}`,
    feeType: f.feeTypeName,
    period: f.periodMonth ? `${f.periodMonth}/${f.periodYear}` : "—",
    billed: f.amountDue,
    paid: f.paid,
    remaining: f.remaining,
    status: f.status,
  }));
  const exportTotals = {
    student: "Total",
    classSection: "",
    feeType: "",
    period: "",
    billed: summary.totalBilled,
    paid: summary.collected,
    remaining: summary.outstanding,
    status: "",
  };
  const filterLabel =
    [
      filters.classId !== "" ? classes.data?.find((c) => c.id === filters.classId)?.name : null,
      filters.status || null,
      `${filters.from} – ${filters.to}`,
    ]
      .filter(Boolean)
      .join(" · ") || "All student fees";

  const handleExport = () => {
    exportStyledExcel({
      filename: "student-fees",
      sheetName: "Student Fees",
      title: "Agradoot Preparatory and High School — Student Fees",
      subtitle: `${filterLabel} · Generated ${new Date().toLocaleString("en-BD")}`,
      columns: exportColumns,
      rows: exportRows,
      totals: exportTotals,
    });
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PrintableSheet
        title="Agradoot Preparatory and High School — Student Fees"
        subtitle={`${filterLabel} · Printed ${new Date().toLocaleString("en-BD")}`}
        columns={[
          { header: "Student", key: "student" },
          { header: "Class / Section", key: "classSection" },
          { header: "Fee type", key: "feeType" },
          { header: "Period", key: "period" },
          { header: "Billed", key: "billed", numeric: true },
          { header: "Paid", key: "paid", numeric: true },
          { header: "Remaining", key: "remaining", numeric: true },
          { header: "Status", key: "status" },
        ]}
        rows={exportRows.map((r) => ({
          ...r,
          billed: money(r.billed),
          paid: money(r.paid),
          remaining: money(r.remaining),
        }))}
        totals={{
          ...exportTotals,
          billed: money(exportTotals.billed),
          paid: money(exportTotals.paid),
          remaining: money(exportTotals.remaining),
        }}
      />

      <div className="finance-stat-grid">
        <Panel className="stat stat-blue">
          <div className="stat-top">
            <span className="stat-icon stat-icon-blue">
              <Wallet />
            </span>
          </div>
          <strong>{money(summary.totalBilled)}</strong>
          <span>Total Billed</span>
        </Panel>
        <Panel className="stat stat-green">
          <div className="stat-top">
            <span className="stat-icon stat-icon-green">
              <CheckCircle2 />
            </span>
          </div>
          <strong>{money(summary.collected)}</strong>
          <span>Collected</span>
        </Panel>
        <Panel className="stat stat-pink">
          <div className="stat-top">
            <span className="stat-icon stat-icon-pink">
              <AlertCircle />
            </span>
          </div>
          <strong>{money(summary.outstanding)}</strong>
          <span>Outstanding</span>
        </Panel>
      </div>

      <Panel>
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            <label>
              Fee Type
              <select
                value={filters.feeTypeId}
                onChange={(e) =>
                  updateFilters({ feeTypeId: e.target.value ? parseInt(e.target.value, 10) : "" })
                }
              >
                <option value="">All Fee Types</option>
                {feeTypes.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment Status
              <select
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value as FeeStatus | "" })}
              >
                <option value="">All Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label>
              Class
              <select
                value={filters.classId}
                onChange={(e) =>
                  updateFilters({
                    classId: e.target.value ? parseInt(e.target.value, 10) : "",
                    sectionId: "",
                  })
                }
              >
                <option value="">All Classes</option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select
                value={filters.sectionId}
                onChange={(e) =>
                  updateFilters({ sectionId: e.target.value ? parseInt(e.target.value, 10) : "" })
                }
              >
                <option value="">All Sections</option>
                {availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="two-fields">
              <label>
                From
                <DateInput value={filters.from} onChange={(e) => updateFilters({ from: e.target.value })} />
              </label>
              <label>
                To
                <DateInput value={filters.to} onChange={(e) => updateFilters({ to: e.target.value })} />
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="search-input" style={{ flex: 1, minWidth: 220 }}>
              <Search size={15} />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                placeholder="Search by student name or ID…"
              />
            </div>
            <Button type="button" variant="ghost" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <div style={{ padding: 16, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={feeRows.length === 0}>
            <Download size={14} />
            Export Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            disabled={feeRows.length === 0}
          >
            <Printer size={14} />
            Print
          </Button>
          <FeeTypeSettingsDialog />
          <BillFeeDialog />
        </div>
        <DataTable
          headers={[
            "STUDENT",
            "CLASS / SECTION",
            "FEE TYPE",
            "PERIOD",
            "BILLED",
            "PAID",
            "REMAINING",
            "STATUS",
            "ACTIONS",
          ]}
          widths="1.4fr 1fr .9fr .7fr .8fr .8fr .8fr .8fr .6fr"
        >
          {fees.isLoading && <EmptyRow colSpan={9}>Loading…</EmptyRow>}
          {!fees.isLoading && feeRows.length === 0 && (
            <EmptyRow colSpan={9}>No fees match your filters.</EmptyRow>
          )}
          {feeRows.map((f) => (
            <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(f.id)}>
              <td>
                <div style={{ fontWeight: 600 }}>{f.studentName}</div>
                <div className="muted-cell mono" style={{ fontSize: 11 }}>
                  ID: {f.studentCode}
                </div>
              </td>
              <td>
                {f.className} · {f.sectionName}
              </td>
              <td>{f.feeTypeName}</td>
              <td className="mono muted-cell">
                {f.periodMonth ? `${f.periodMonth}/${f.periodYear}` : "—"}
              </td>
              <td className="mono">{money(f.amountDue)}</td>
              <td className="mono">{money(f.paid)}</td>
              <td className="mono strong">{money(f.remaining)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <StatusSelect fee={f} onChange={handleStatusChange} />
              </td>
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="More actions">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedId(f.id)}>
                      <Eye size={14} />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={f.paid <= 0} onClick={() => downloadReceipt(f)}>
                      <Download size={14} />
                      Download Receipt
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={f.paid <= 0} onClick={() => openReceipt(f)}>
                      <Printer size={14} />
                      Print Receipt
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={f.remaining <= 0} onClick={() => setSelectedId(f.id)}>
                      <Wallet size={14} />
                      Record Payment
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEditingFee(f)}>
                      <Pencil size={14} />
                      Edit Fee Bill
                    </DropdownMenuItem>
                    <DropdownMenuItem className="danger-item" onClick={() => deleteFee.mutate(f)}>
                      <Trash2 size={14} />
                      Delete Fee Bill
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </DataTable>
        <div className="results-footer">
          <span className="muted-cell" style={{ fontSize: 13 }}>
            {total === 0
              ? "No records"
              : `Showing ${rangeStart}–${rangeEnd} of ${total} records`}
          </span>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="mono" style={{ fontSize: 13 }}>
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Panel>

      {selectedId && <StudentFeeDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
      {editingFee && <EditStudentFeeDialog fee={editingFee} onClose={() => setEditingFee(null)} />}
      {partialPayFee && (
        <PartialPaymentDialog fee={partialPayFee} onClose={() => setPartialPayFee(null)} />
      )}
      {receipt && (
        <ReceiptDialog
          payment={receipt.payment}
          fee={receipt.fee}
          autoPrint={receipt.autoPrint}
          onClose={() => setReceipt(null)}
        />
      )}
    </>
  );
}
