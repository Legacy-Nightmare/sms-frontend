import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SCHOOL_LOGO, SCHOOL_NAME } from "@/lib/school-info";
import type { PaymentDto, StudentFeeDto } from "@/lib/finance-api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

export function ReceiptDialog({
  payment,
  fee,
  onClose,
}: {
  payment: PaymentDto;
  fee: StudentFeeDto;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="print-dialog" style={{ maxWidth: 480 }}>
        <div className="print-area">
          <div className="print-letterhead">
            <img src={SCHOOL_LOGO} alt="" />
            <div>
              <h2>{SCHOOL_NAME}</h2>
              <p>Fee Payment Receipt</p>
            </div>
          </div>
          <table className="print-doc-table">
            <tbody>
              <tr>
                <th style={{ width: "40%" }}>Receipt No.</th>
                <td className="mono">{payment.receiptNumber ?? "—"}</td>
              </tr>
              <tr>
                <th>Date</th>
                <td className="mono">{payment.paidAt}</td>
              </tr>
              <tr>
                <th>Student</th>
                <td>
                  {fee.studentName} ({fee.studentCode})
                </td>
              </tr>
              <tr>
                <th>Class</th>
                <td>{fee.className}</td>
              </tr>
              <tr>
                <th>Fee type</th>
                <td>
                  {fee.feeTypeName}
                  {fee.periodMonth ? ` — ${fee.periodMonth}/${fee.periodYear}` : ""}
                </td>
              </tr>
              <tr>
                <th>Payment method</th>
                <td style={{ textTransform: "capitalize" }}>{payment.method}</td>
              </tr>
              <tr>
                <th>Received by</th>
                <td>{payment.receivedByName ?? "—"}</td>
              </tr>
              {payment.note && (
                <tr>
                  <th>Note</th>
                  <td>{payment.note}</td>
                </tr>
              )}
            </tbody>
          </table>

          <table className="print-doc-table" style={{ marginTop: 10 }}>
            <tbody>
              <tr>
                <th style={{ width: "40%" }}>Amount paid (this receipt)</th>
                <td className="mono strong">{money(payment.amount)}</td>
              </tr>
              <tr>
                <th>Fee total due</th>
                <td className="mono">{money(fee.amountDue)}</td>
              </tr>
              <tr>
                <th>Total paid to date</th>
                <td className="mono">{money(fee.paid)}</td>
              </tr>
              <tr>
                <th>Remaining balance</th>
                <td className="mono">{money(fee.remaining)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="drawer-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
