import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_NAME } from "@/lib/school-info";
import { fetchSchoolProfile } from "@/lib/website-api";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import type { PaymentDto, StudentFeeDto } from "@/lib/finance-api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

// A receipt copy is one payment against one fee bill, so "previous dues" is
// everything still owed on this same bill right before this payment landed
// — the current remaining plus what this receipt just paid, not some
// separate running balance.
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
  const previousDues = fee.remaining + payment.amount;
  const feeTypeLabel = fee.periodMonth
    ? `${fee.feeTypeName} — ${fee.periodMonth}/${fee.periodYear}`
    : fee.feeTypeName;

  return (
    <div className="receipt-copy">
      <div className="receipt-copy-tag">{copyLabel}</div>
      <div className="receipt-header">
        <h2>School&rsquo;s Fee Receipt</h2>
        <p>{SCHOOL_NAME}</p>
        {phone && <p>TEL.#{phone}</p>}
      </div>

      <div className="receipt-field receipt-field-date">
        <span className="receipt-label">Date</span>
        <span className="receipt-value mono">{payment.paidAt}</span>
      </div>

      <div className="receipt-row">
        <div className="receipt-field" style={{ flex: 1.6 }}>
          <span className="receipt-label">Student&rsquo;s Name</span>
          <span className="receipt-value">{fee.studentName}</span>
        </div>
        <div className="receipt-field">
          <span className="receipt-label">Class</span>
          <span className="receipt-value">
            {fee.className} · {fee.sectionName}
          </span>
        </div>
      </div>

      <div className="receipt-field">
        <span className="receipt-label">Roll No</span>
        <span className="receipt-value mono">{fee.roll}</span>
      </div>

      <div className="receipt-row">
        <div className="receipt-field" style={{ flex: 1.6 }}>
          <span className="receipt-label">Fee Type</span>
          <span className="receipt-value">{feeTypeLabel}</span>
        </div>
        <div className="receipt-field">
          <span className="receipt-label">Previous Dues</span>
          <span className="receipt-value mono">{money(previousDues)}</span>
        </div>
      </div>

      <div className="receipt-row">
        <div className="receipt-field">
          <span className="receipt-label">Total Dues</span>
          <span className="receipt-value mono">{money(fee.amountDue)}</span>
        </div>
        <div className="receipt-field">
          <span className="receipt-label">Received</span>
          <span className="receipt-value mono strong">{money(payment.amount)}</span>
        </div>
      </div>

      <div className="receipt-field">
        <span className="receipt-label">Remaining Dues</span>
        <span className="receipt-value mono">{money(fee.remaining)}</span>
      </div>

      <div className="receipt-row">
        <div className="receipt-field">
          <span className="receipt-label">Received By</span>
          <span className="receipt-value">APHS Authority</span>
        </div>
        <div className="receipt-field">
          <span className="receipt-label">Signature</span>
          <span className="receipt-value">&nbsp;</span>
        </div>
      </div>

      {payment.receiptNumber && (
        <p className="receipt-number mono">Receipt No. {payment.receiptNumber}</p>
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
            onClick={() => downloadReceiptPdf(payment, fee, profile.data?.phone)}
          >
            <Download size={14} />
            Download PDF
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
