import { useState } from "react";
import { PageHeading } from "@/components/dashboard-ui";
import { FinanceReportTab } from "@/components/finance/finance-report-tab";
import { StudentFeesTab } from "@/components/finance/student-fees-tab";
import { TeacherSalaryTab } from "@/components/finance/teacher-salary-tab";
import { ExpensesTab } from "@/components/finance/expenses-tab";

type FinanceTab = "overview" | "student-fees" | "salary" | "expenses";

const TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "student-fees", label: "Student Fees" },
  { id: "salary", label: "Teacher Salary" },
  { id: "expenses", label: "Expenses" },
];

export function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>("overview");

  return (
    <>
      <PageHeading
        title="Finance"
        subtitle="Student fees, teacher salary, expenses, and profit/loss"
      />
      <div className="finance-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "finance-tab active" : "finance-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <FinanceReportTab />}
      {tab === "student-fees" && <StudentFeesTab />}
      {tab === "salary" && <TeacherSalaryTab />}
      {tab === "expenses" && <ExpensesTab />}
    </>
  );
}
