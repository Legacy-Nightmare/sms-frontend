import { useState } from "react";
import { CalendarDays, Download, GraduationCap, IdCard, User, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { downloadSalaryReceiptPdf } from "@/lib/salary-receipt-pdf";
import type { FeeStatus, PaymentDto, TeacherSalaryDto } from "@/lib/finance-api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STAMP: Record<FeeStatus, { label: string; tone: string }> = {
  PAID: { label: "Paid", tone: "green" },
  PARTIAL: { label: "Partial", tone: "amber" },
  UNPAID: { label: "Due", tone: "red" },
};

// Mirrors receipt-dialog.tsx's ReceiptCopy (the branded card redesign), for
// teacher-salary payments instead of student fees.
function SalaryReceiptCopy({
  copyLabel,
  payment,
  salary,
}: {
  copyLabel: string;
  payment: PaymentDto;
  salary: TeacherSalaryDto;
}) {
  // Always zero — see receipt-dialog.tsx's ReceiptCopy for why.
  const previousDues = 0;
  const stamp = STAMP[salary.status];
  const employeeId = `T-${String(salary.teacherId).padStart(4, "0")}`;
  const designation = salary.teacherSubject ? `${salary.teacherSubject} Teacher` : "Teacher";
  const salaryMonth = `${MONTH_NAMES[salary.periodMonth - 1]} ${salary.periodYear}`;

  return (
    <div className="receipt-copy receipt-fee-card">
      <div className="receipt-copy-tag">{copyLabel}</div>

      <div className="rf-header">
        <img src={SCHOOL_LOGO} alt="" className="rf-logo" />
        <div className="rf-header-text">
          <h2>{SCHOOL_NAME}</h2>
        </div>
      </div>

      <div className="rf-title-row">
        <span className="rf-title-line" />
        <span className="rf-title-pill">Salary Receipt</span>
        <span className="rf-title-line" />
      </div>

      <div className="rf-info-bar">
        <div className="rf-info-item">
          <User size={15} />
          <div>
            <span>Teacher&rsquo;s Name</span>
            <strong>{salary.teacherName}</strong>
          </div>
        </div>
        <div className="rf-info-item">
          <IdCard size={15} />
          <div>
            <span>Employee ID</span>
            <strong>{employeeId}</strong>
          </div>
        </div>
        <div className="rf-info-item">
          <GraduationCap size={15} />
          <div>
            <span>Designation</span>
            <strong>{designation}</strong>
          </div>
        </div>
        <div className="rf-info-item">
          <CalendarDays size={15} />
          <div>
            <span>Date</span>
            <strong>{payment.paidAt}</strong>
          </div>
        </div>
      </div>

      <div className="rf-body">
        <table className="rf-table">
          <tbody>
            <tr className="rf-row-highlight-blue">
              <td>Salary Month</td>
              <td>{salaryMonth}</td>
            </tr>
            <tr>
              <td>Monthly Salary</td>
              <td>{money(salary.amountDue)}</td>
            </tr>
            <tr>
              <td>Previous Dues</td>
              <td>{money(previousDues)}</td>
            </tr>
            <tr>
              <td>Received</td>
              <td>{money(payment.amount)}</td>
            </tr>
            <tr className="rf-row-highlight">
              <td>Remaining Dues</td>
              <td>{money(salary.remaining)}</td>
            </tr>
          </tbody>
        </table>
        <div className="rf-stamp-col">
          <div className={`rf-stamp rf-stamp-${stamp.tone}`}>
            <div className="rf-stamp-ring">
              <span className="rf-stamp-stars">&#9733; &#9733; &#9733;</span>
              <strong>{stamp.label}</strong>
              <span className="rf-stamp-stars">&#9733; &#9733; &#9733;</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rf-footer-row">
        <div className="rf-received-by">
          <UserCheck size={15} />
          <div>
            <span>Paid By</span>
            <strong>APHS Authority</strong>
          </div>
        </div>
        <div className="rf-signature">
          <div className="rf-signature-line" />
          <span>Signature</span>
        </div>
      </div>

      {payment.receiptNumber && (
        <p className="rf-receipt-tag mono">Receipt No.: {payment.receiptNumber}</p>
      )}
    </div>
  );
}

export function SalaryReceiptDialog({
  payment,
  salary,
  onClose,
}: {
  payment: PaymentDto;
  salary: TeacherSalaryDto;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="print-dialog" style={{ maxWidth: 620 }}>
        <div className="print-area">
          <SalaryReceiptCopy copyLabel="Teacher Copy" payment={payment} salary={salary} />
          <div className="receipt-cut-line">
            <span>✂</span>
          </div>
          <SalaryReceiptCopy copyLabel="Office Copy" payment={payment} salary={salary} />
        </div>

        <div className="drawer-actions" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadSalaryReceiptPdf(payment, salary);
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Download size={14} />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
