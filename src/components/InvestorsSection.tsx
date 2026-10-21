import { InvestorPaymentBadge } from "@/components/Badges";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { ChevronDown, UserRound } from "lucide-react";

const KYC_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-700",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700",
  PENDING: "bg-slate-500/10 text-slate-500",
  REJECTED: "bg-rose-500/10 text-rose-700",
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  reference: string;
  status: string;
  paidAt: Date | string;
  receivedAt?: Date | string;
  acknowledgedAt?: Date | string | null;
  receiptRef: string | null;
  notificationStatus: string;
};

type Investor = {
  id: string;
  name: string;
  email: string | null;
  committedAmount: number;
  kycStatus: string;
  paymentStatus: string;
  payments: Payment[];
};

export function InvestorsSection({ investors }: { investors: Investor[] }) {
  if (investors.length === 0) {
    return <p className="text-sm text-slate-500">No investors are recorded for this project yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        An investment commitment is separate from cash received. Amount paid is the total of
        payments confirmed by the source application; outstanding is shown only where the
        commitment exceeds confirmed payments. Receipts are issued automatically when a payment is
        confirmed — no manual acknowledgement is required.
      </p>
      {investors.map((investor) => {
        const paid = investor.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const outstanding = Math.max(0, investor.committedAmount - paid);
        const fundingLabel =
          paid >= investor.committedAmount
            ? "Fully funded"
            : paid > 0
              ? "Partially funded"
              : "Awaiting first payment";

        return (
          <details
            key={investor.id}
            className="group rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <summary className="list-none cursor-pointer px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3 hover:bg-slate-50">
              <span className="flex items-center gap-2 min-w-[220px]">
                <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <UserRound className="w-4 h-4 text-slate-500" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {investor.name}
                  </span>
                  <span className="block text-xs text-slate-500">{investor.email ?? "—"}</span>
                </span>
              </span>
              <span className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 flex-1 text-xs">
                <span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Commitment
                  </span>
                  <span className="font-mono text-slate-900">
                    {formatNaira(investor.committedAmount)}
                  </span>
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Amount paid
                  </span>
                  <span className="font-mono text-emerald-600">{formatNaira(paid)}</span>
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Outstanding
                  </span>
                  <span className={outstanding ? "font-mono text-amber-600" : "text-slate-500"}>
                    {outstanding ? formatNaira(outstanding) : "—"}
                  </span>
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Investment status
                  </span>
                  <span className="text-slate-700">{fundingLabel}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                    KYC_STYLES[investor.kycStatus] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  KYC {investor.kycStatus.replace(/_/g, " ")}
                </span>
                <InvestorPaymentBadge status={investor.paymentStatus} />
                <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" />
              </span>
            </summary>

            <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
              <p className="text-xs font-semibold text-slate-700 mb-2">Payment history</p>
              {investor.payments.length === 0 ? (
                <p className="text-xs text-slate-500">No confirmed payments recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4">Reference</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Confirmation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {investor.payments.map((payment) => (
                        <tr key={payment.id} className="align-top">
                          <td className="py-2 pr-4 text-slate-500">
                            {formatDateTime(payment.paidAt)}
                          </td>
                          <td className="py-2 pr-4 font-mono text-slate-900">
                            {formatNaira(payment.amount)}
                          </td>
                          <td className="py-2 pr-4 text-slate-600">
                            {(payment.method ?? "—").replace(/_/g, " ")}
                          </td>
                          <td className="py-2 pr-4 font-mono text-slate-600">
                            {payment.reference}
                          </td>
                          <td className="py-2 pr-4">
                            <InvestorPaymentBadge status={payment.status} />
                          </td>
                          <td className="py-2 pr-4">
                            {payment.receiptRef ? (
                              <span className="text-emerald-700 font-mono">
                                {payment.receiptRef}
                              </span>
                            ) : (
                              <span className="text-slate-400">Awaiting source confirmation</span>
                            )}
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Notification: {payment.notificationStatus.toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-3">
                Exit and payout amounts are governed by the project&apos;s investment terms. See the
                investor withdrawals and payouts section for the current position.
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
