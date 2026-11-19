import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, GraduationCap, IdCard, User, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import { fetchSchoolProfile } from "@/lib/website-api";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import type { FeeStatus, PaymentDto, StudentFeeDto } from "@/lib/finance-api";

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

function ReceiptCopy({
  copyLabel,
  payment,
  fee,
  phone,
}: {
  copyLabel: string;
  payment: PaymentDto;
  fee: StudentFeeDto;
  phone: string | null | undefined;
}) {
  // Always shown as zero — asked for explicitly: computing it from
  // fee.remaining + payment.amount confused readers (it often just echoes
  // the amount received back as "previous dues").
  const previousDues = 0;
  const periodLabel = fee.examName
    ? (["Exam", fee.examName] as const)
    : fee.periodMonth
      ? (["Billing Period", `${MONTH_NAMES[fee.periodMonth - 1]} ${fee.periodYear}`] as const)
      : null;
  const stamp = STAMP[fee.status];

  return (
    <div className="receipt-copy receipt-fee-card">
      <div className="receipt-copy-tag">{copyLabel}</div>

      <div className="rf-header">
        <img src={SCHOOL_LOGO} alt="" className="rf-logo" />
        <div className="rf-header-text">
          <h2>{SCHOOL_NAME}</h2>
          {phone && <p>TEL. #{phone}</p>}
        </div>
      </div>

      <div className="rf-title-row">
        <span className="rf-title-line" />
        <span className="rf-title-pill">Fee Receipt</span>
        <span className="rf-title-line" />
      </div>

      <div className="rf-info-bar">
        <div className="rf-info-item">
          <User size={15} />
          <div>
            <span>Student&rsquo;s Name</span>
            <strong>{fee.studentName}</strong>
          </div>
        </div>
        <div className="rf-info-item">
          <GraduationCap size={15} />
          <div>
            <span>Class</span>
            <strong>
              {fee.className} &middot; {fee.sectionName}
            </strong>
          </div>
        </div>
        <div className="rf-info-item">
          <IdCard size={15} />
          <div>
            <span>Roll No</span>
            <strong>{fee.roll}</strong>
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
            <tr>
              <td>Fee Type</td>
              <td>{fee.feeTypeName}</td>
            </tr>
            {periodLabel && (
              <tr className="rf-row-highlight-blue">
                <td>{periodLabel[0]}</td>
                <td>{periodLabel[1]}</td>
              </tr>
            )}
            <tr>
              <td>Previous Dues</td>
              <td>{money(previousDues)}</td>
            </tr>
            <tr>
              <td>Total Dues</td>
              <td>{money(fee.amountDue)}</td>
            </tr>
            <tr>
              <td>Received</td>
              <td>{money(payment.amount)}</td>
            </tr>
            <tr className="rf-row-highlight">
              <td>Remaining Dues</td>
              <td>{money(fee.remaining)}</td>
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
            <span>Received By</span>
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

export function ReceiptDialog({
  payment,
  fee,
  onClose,
  autoPrint = false,
}: {
  payment: PaymentDto;
  fee: StudentFeeDto;
  onClose: () => void;
  autoPrint?: boolean;
}) {
  const profile = useQuery({ queryKey: ["school-profile"], queryFn: fetchSchoolProfile });
  const [downloading, setDownloading] = useState(false);

  // "Print Receipt" row actions jump straight to the system print dialog
  // instead of making the user open this dialog and click Print themselves.
  useEffect(() => {
    if (autoPrint) window.print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="print-dialog" style={{ maxWidth: 620 }}>
        <div className="print-area">
          <ReceiptCopy
            copyLabel="Student Copy"
            payment={payment}
            fee={fee}
            phone={profile.data?.phone}
          />
          <div className="receipt-cut-line">
            <span>✂</span>
          </div>
          <ReceiptCopy
            copyLabel="Authority Copy"
            payment={payment}
            fee={fee}
            phone={profile.data?.phone}
          />
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
                await downloadReceiptPdf(payment, fee, profile.data?.phone);
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
