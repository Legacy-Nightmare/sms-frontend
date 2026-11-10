import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Plus,
  Printer,
  Search,
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
import { DateInput } from "@/components/ui/date-input";
import { Badge, Panel } from "@/components/dashboard-ui";
import { PrintableSheet } from "@/components/printable-sheet";
import { ApiError } from "@/lib/api";
import { exportStyledExcel } from "@/lib/excel-export";
import { fetchTeachers, type TeacherDto } from "@/lib/teachers-api";
import { fetchSubjectCatalog } from "@/lib/subjects-catalog-api";
import { fetchClasses } from "@/lib/academics-api";
import {
  bulkGenerateSalary,
  fetchTeacherSalaries,
  fetchTeacherSalary,
  recordSalaryPayment,
  voidSalaryPayment,
  type FeeStatus,
  type PaymentMethod,
} from "@/lib/finance-api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusTone: Record<FeeStatus, string> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };
const statusLabel: Record<FeeStatus, string> = { PAID: "Paid", PARTIAL: "Partially Paid", UNPAID: "Unpaid" };
const methodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  bkash: "bKash",
  nagad: "Nagad",
  other: "Other",
};

function GenerateSalaryDialog({
  periodMonth,
  periodYear,
}: {
  periodMonth: number;
  periodYear: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers, enabled: open });

  const withSalary = (teachers.data ?? []).filter((t) => t.salary != null);
  const withoutSalary = (teachers.data ?? []).filter((t) => t.salary == null);

  const mutation = useMutation({
    mutationFn: () =>
      bulkGenerateSalary({
        teacherIds: withSalary.map((t) => t.id),
        periodMonth,
        periodYear,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-salaries"] });
      toast.success(
        `Generated ${res.created} salary record(s)` +
          (res.skipped ? `, skipped ${res.skipped} already set` : ""),
      );
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate salary"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Generate salary
      </Button>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>
            Generate salary — {MONTH_NAMES[periodMonth - 1]} {periodYear}
          </DialogTitle>
        </DialogHeader>
        <div style={{ display: "grid", gap: 14 }}>
          <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
            Creates this month's salary record for every teacher using their own salary (set on
            their roster profile) — teachers who already have a record for this month are
            skipped, not overwritten.
          </p>
          {withSalary.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>
                Will generate for {withSalary.length} teacher(s)
              </p>
              <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                {withSalary.map((t) => (
                  <div
                    key={t.id}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span>{t.name}</span>
                    <span className="mono muted-cell">৳{t.salary!.toLocaleString("en-BD")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {withoutSalary.length > 0 && (
            <p className="muted-cell" style={{ fontSize: 12, margin: 0 }}>
              Skipping {withoutSalary.length} teacher(s) with no salary set: {" "}
              {withoutSalary.map((t) => t.name).join(", ")} — add a salary on their profile first.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
              No teachers on the roster yet.
            </p>
          )}
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={mutation.isPending || withSalary.length === 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>
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
  const d = detail.data;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (d) setAmount(String(d.remaining));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d?.remaining]);

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
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        {d && (
          <>
            <DialogHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 24 }}>
                <DialogTitle>Teacher Salary Details</DialogTitle>
                <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>
              </div>
            </DialogHeader>
            <div>
              <strong style={{ fontSize: 16 }}>{d.teacherName}</strong>
              <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 12 }}>
                {d.teacherSubject ? `${d.teacherSubject} Teacher` : "Teacher"} · T-
                {String(d.teacherId).padStart(4, "0")}
              </p>
            </div>
            <div className="two-fields" style={{ fontSize: 13, rowGap: 14 }}>
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Monthly salary
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
              <div>
                <span className="muted-cell" style={{ fontSize: 11, display: "block" }}>
                  Salary month
                </span>
                <strong>
                  {MONTH_NAMES[d.periodMonth - 1]} {d.periodYear}
                </strong>
              </div>
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
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>Make a Payment</p>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TeacherSalaryTab() {
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FeeStatus>("ALL");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState<number | "">(""); // classId, not level
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const salaries = useQuery({
    queryKey: ["teacher-salaries", periodMonth, periodYear],
    queryFn: () => fetchTeacherSalaries({ periodMonth, periodYear, pageSize: 200 }),
  });
  const rows = salaries.data?.rows ?? [];

  // Salary records aren't per class/subject (a teacher has one salary a
  // month, however many classes they teach) — filtering "by subject/class"
  // means showing only teachers who have that assignment, via the roster's
  // own assignments list.
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const assignmentsByTeacher = useMemo(() => {
    const map = new Map<number, TeacherDto["assignments"]>();
    for (const t of teachersQuery.data ?? []) map.set(t.id, t.assignments);
    return map;
  }, [teachersQuery.data]);
  // Filter options list the full catalog/every class, not just the ones a
  // teacher currently happens to be assigned to — otherwise a subject or
  // class nobody's assigned to yet would be impossible to even select.
  const subjectCatalogQuery = useQuery({ queryKey: ["subject-catalog"], queryFn: fetchSubjectCatalog });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const subjectOptions = useMemo(
    () => (subjectCatalogQuery.data ?? []).map((s) => s.name).sort(),
    [subjectCatalogQuery.data],
  );
  const classOptions = useMemo(
    () =>
      [...(classesQuery.data ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c): [number, string] => [c.id, c.name]),
    [classesQuery.data],
  );

  const totals = useMemo(() => {
    const totalSalary = rows.reduce((s, r) => s + r.amountDue, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const partiallyPaidDue = rows
      .filter((r) => r.status === "PARTIAL")
      .reduce((s, r) => s + r.remaining, 0);
    const unpaidDue = rows
      .filter((r) => r.status === "UNPAID")
      .reduce((s, r) => s + r.amountDue, 0);
    return { totalSalary, totalPaid, partiallyPaidDue, unpaidDue, remaining: totalSalary - totalPaid };
  }, [rows]);

  const progressPct = totals.totalSalary > 0 ? Math.round((totals.totalPaid / totals.totalSalary) * 1000) / 10 : 0;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (query && !r.teacherName.toLowerCase().includes(query)) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      const assignments = assignmentsByTeacher.get(r.teacherId) ?? [];
      if (subjectFilter && !assignments.some((a) => a.subjectName === subjectFilter)) return false;
      if (classFilter !== "" && !assignments.some((a) => a.classId === classFilter)) return false;
      return true;
    });
  }, [rows, search, statusFilter, subjectFilter, classFilter, assignmentsByTeacher]);

  const periodLabel = `${MONTH_NAMES[periodMonth - 1]} ${periodYear}`;
  const exportColumns = [
    { header: "Teacher", key: "teacher" },
    { header: "Subject", key: "subject" },
    { header: "Period", key: "period" },
    { header: "Due", key: "due", type: "currency" as const },
    { header: "Paid", key: "paid", type: "currency" as const },
    { header: "Remaining", key: "remaining", type: "currency" as const },
    { header: "Status", key: "status" },
  ];
  const exportRows = filteredRows.map((r) => ({
    teacher: r.teacherName,
    subject: r.teacherSubject ?? "—",
    period: `${r.periodMonth}/${r.periodYear}`,
    due: r.amountDue,
    paid: r.paid,
    remaining: r.remaining,
    status: statusLabel[r.status],
  }));
  const exportTotals = {
    teacher: "Total",
    subject: "",
    period: "",
    due: totals.totalSalary,
    paid: totals.totalPaid,
    remaining: totals.remaining,
    status: "",
  };

  const handleExport = () => {
    exportStyledExcel({
      filename: `teacher-salary-${periodYear}-${String(periodMonth).padStart(2, "0")}`,
      sheetName: "Teacher Salary",
      title: "Agradoot Preparatory and High School — Teacher Salary",
      subtitle: `Period: ${periodLabel} · Generated ${new Date().toLocaleString("en-BD")}`,
      columns: exportColumns,
      rows: exportRows,
      totals: exportTotals,
    });
  };

  return (
    <>
      <PrintableSheet
        title="Agradoot Preparatory and High School — Teacher Salary"
        subtitle={`Period: ${periodLabel} · Printed ${new Date().toLocaleString("en-BD")}`}
        columns={[
          { header: "Teacher", key: "teacher" },
          { header: "Subject", key: "subject" },
          { header: "Period", key: "period" },
          { header: "Due", key: "due", numeric: true },
          { header: "Paid", key: "paid", numeric: true },
          { header: "Remaining", key: "remaining", numeric: true },
          { header: "Status", key: "status" },
        ]}
        rows={exportRows.map((r) => ({
          ...r,
          due: money(r.due),
          paid: money(r.paid),
          remaining: money(r.remaining),
        }))}
        totals={{
          ...exportTotals,
          due: money(exportTotals.due),
          paid: money(exportTotals.paid),
          remaining: money(exportTotals.remaining),
        }}
      />
      <div className="panel-title" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={periodYear}
            onChange={(e) => setPeriodYear(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exportRows.length === 0}>
            <Download size={14} />
            Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={exportRows.length === 0}>
            <Printer size={14} />
            Print
          </Button>
          <GenerateSalaryDialog periodMonth={periodMonth} periodYear={periodYear} />
        </div>
      </div>

      <div className="stat-grid">
        <Panel className="stat stat-blue">
          <div className="stat-top">
            <span className="stat-icon stat-icon-blue">
              <Wallet />
            </span>
          </div>
          <strong>{money(totals.totalSalary)}</strong>
          <span>Total Salary</span>
        </Panel>
        <Panel className="stat stat-green">
          <div className="stat-top">
            <span className="stat-icon stat-icon-green">
              <CheckCircle2 />
            </span>
          </div>
          <strong>{money(totals.totalPaid)}</strong>
          <span>Total Paid</span>
        </Panel>
        <Panel className="stat stat-orange">
          <div className="stat-top">
            <span className="stat-icon stat-icon-orange">
              <AlertCircle />
            </span>
          </div>
          <strong>{money(totals.partiallyPaidDue)}</strong>
          <span>Partially Paid</span>
        </Panel>
        <Panel className="stat stat-pink">
          <div className="stat-top">
            <span className="stat-icon stat-icon-pink">
              <AlertTriangle />
            </span>
          </div>
          <strong>{money(totals.unpaidDue)}</strong>
          <span>Unpaid / Outstanding</span>
        </Panel>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Panel>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Salary Payment Progress</strong>
              <strong style={{ fontSize: 13, color: "var(--green)" }}>{progressPct}%</strong>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(progressPct, 100)}%`, background: "var(--green)" }}
              />
            </div>
            <div
              className="muted-cell"
              style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}
            >
              <span>Paid: {money(totals.totalPaid)}</span>
              <span>Remaining: {money(totals.remaining)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="panel-title">
          <h2>Teacher Salary Records</h2>
          <Badge tone="teal">{rows.length} Teachers</Badge>
        </div>
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="search-input" style={{ flex: "1 1 220px" }}>
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher…"
              />
            </div>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="">All subjects</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">All classes</option>
              {classOptions.map(([classId, name]) => (
                <option key={classId} value={classId}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="finance-tabs">
            {(["ALL", "PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? "finance-tab active" : "finance-tab"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? "All" : statusLabel[s]}
              </button>
            ))}
          </div>
        </div>

        {salaries.isLoading && <p className="muted-cell" style={{ padding: 16 }}>Loading…</p>}
        {!salaries.isLoading && rows.length === 0 && (
          <p className="muted-cell" style={{ padding: 16 }}>
            No salary records for {MONTH_NAMES[periodMonth - 1]} {periodYear} yet — generate them
            above.
          </p>
        )}
        {!salaries.isLoading && rows.length > 0 && filteredRows.length === 0 && (
          <p className="muted-cell" style={{ padding: 16 }}>
            No teachers match your filters.
          </p>
        )}
        {filteredRows.map((r) => {
          const pct = r.amountDue > 0 ? Math.min(100, Math.round((r.paid / r.amountDue) * 100)) : 0;
          return (
            <div key={r.id} className="salary-row" onClick={() => setSelectedId(r.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{r.teacherName}</strong>
                  <p className="muted-cell" style={{ margin: "2px 0 0", fontSize: 12 }}>
                    {r.teacherSubject ? `${r.teacherSubject} Teacher` : "Teacher"}
                  </p>
                </div>
                <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0 6px", fontSize: 12 }}>
                <span className="muted-cell">Salary: {money(r.amountDue)}</span>
                <span>Paid: {money(r.paid)}</span>
              </div>
              <div className="progress-track progress-track-sm">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, background: r.status === "UNPAID" ? "var(--red)" : "var(--green)" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span className="muted-cell" style={{ fontSize: 12 }}>
                  Due: {money(r.remaining)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(r.id);
                  }}
                >
                  View / Pay
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </Panel>

      {selectedId !== null && (
        <SalaryDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
