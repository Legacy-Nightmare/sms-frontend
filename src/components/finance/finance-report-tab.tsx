import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, DataTable, EmptyRow, Panel } from "@/components/dashboard-ui";
import { fetchClasses } from "@/lib/academics-api";
import { fetchFinanceSummary, fetchFinanceTrend, fetchStudentsWithDues } from "@/lib/finance-api";
import { downloadCsv } from "@/lib/csv";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

export function FinanceReportTab() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [classId, setClassId] = useState<number | "">("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });

  const summary = useQuery({
    queryKey: ["finance-summary", from, to, classId],
    queryFn: () => fetchFinanceSummary({ from, to, classId: classId === "" ? undefined : classId }),
  });
  const trend = useQuery({
    queryKey: ["finance-trend", from, to],
    queryFn: () => fetchFinanceTrend(from, to),
  });
  const dues = useQuery({
    queryKey: ["students-with-dues", classId],
    queryFn: () =>
      fetchStudentsWithDues({ classId: classId === "" ? undefined : classId, pageSize: 100 }),
  });

  const profit = summary.data?.profitLoss ?? 0;

  const exportDues = async () => {
    const all = await fetchStudentsWithDues({
      classId: classId === "" ? undefined : classId,
      pageSize: 1000,
    });
    downloadCsv(
      `students-with-dues-${from}-to-${to}.csv`,
      ["Student", "Code", "Class", "Total Due", "Total Paid", "Remaining"],
      all.rows.map((r) => [
        r.studentName,
        r.studentCode,
        r.className,
        r.totalDue,
        r.totalPaid,
        r.totalRemaining,
      ]),
    );
  };

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
          <label style={{ minWidth: 180 }}>
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
        </div>
      </Panel>

      <div className="finance-stat-grid">
        <Panel className="stat stat-mint">
          <span>Total Income</span>
          <strong>{money(summary.data?.totalIncome ?? 0)}</strong>
          <small>Cash received this period</small>
        </Panel>
        <Panel className="stat stat-orange">
          <span>Total Expense</span>
          <strong>{money(summary.data?.totalExpense ?? 0)}</strong>
          <small>
            Salary {money(summary.data?.salaryExpense ?? 0)} + Other{" "}
            {money(summary.data?.otherExpense ?? 0)}
          </small>
        </Panel>
        <Panel className={`stat ${profit >= 0 ? "stat-green" : "stat-pink"}`}>
          <span>Profit / Loss</span>
          <strong style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
            {profit >= 0 ? "+" : "−"}
            {money(Math.abs(profit))}
          </strong>
          <small>Income − expense, this period</small>
        </Panel>
        <Panel className="stat stat-purple">
          <span>Total Due</span>
          <strong>{money(summary.data?.totalDue ?? 0)}</strong>
          <small>Unpaid student fee balances, now</small>
        </Panel>
        <Panel className="stat stat-orange">
          <span>Salary Payable</span>
          <strong>{money(summary.data?.salaryPayable ?? 0)}</strong>
          <small>Unpaid teacher salary, now</small>
        </Panel>
      </div>

      <Panel>
        <div className="panel-title">
          <h2>Income vs Expense</h2>
          <span className="chart-legend">
            <em style={{ background: "var(--teal)" }} /> Income
            <em style={{ background: "var(--red)" }} /> Expense
          </span>
        </div>
        <div style={{ height: 240, padding: "12px 6px 0" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.data ?? []} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(new Date(d), "d MMM")}
                fontSize={11}
              />
              <YAxis fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => format(new Date(d as string), "d MMM yyyy")}
                formatter={(value: number) => money(value)}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--teal)"
                fill="url(#incomeFill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="var(--red)"
                fill="url(#expenseFill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel>
        <div className="panel-title">
          <h2>Students with dues</h2>
          <Button size="sm" variant="outline" onClick={exportDues}>
            <Download />
            Export CSV
          </Button>
        </div>
        <DataTable
          headers={["STUDENT", "CLASS", "TOTAL DUE", "PAID", "REMAINING"]}
          widths="1.4fr 1fr 1fr 1fr 1fr"
        >
          {dues.isLoading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
          {dues.data?.rows.length === 0 && <EmptyRow colSpan={5}>No outstanding dues 🎉</EmptyRow>}
          {dues.data?.rows.map((r) => (
            <tr key={r.studentId}>
              <td>
                {r.studentName} <span className="muted-cell mono">({r.studentCode})</span>
              </td>
              <td>{r.className}</td>
              <td className="mono">{money(r.totalDue)}</td>
              <td className="mono muted-cell">{money(r.totalPaid)}</td>
              <td className="mono strong">
                <Badge tone="red">{money(r.totalRemaining)}</Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
