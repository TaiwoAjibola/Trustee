/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { KycStatus, ProjectStatus } from "@prisma/client";
import { formatNaira } from "@/lib/utils";
import { InvestorPaymentAck } from "@/components/InvestorPaymentAck";
import { StatusBadge } from "@/components/Badges";
import { CheckCircle2 } from "lucide-react";

const KYC_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-600",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-600",
  PENDING: "bg-slate-500/10 text-slate-500",
  REJECTED: "bg-rose-500/10 text-rose-600",
};

export default async function PortfolioPage() {
  const projects = await prisma.project.findMany({
    include: {
      bankAccounts: true,
      investors: { include: { payments: true } },
      developers: true,
      drawdownRequests: { orderBy: { submissionDate: "desc" } },
      monitorAssignments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingPayments = projects.flatMap((p) =>
    p.investors.flatMap((investor: any) =>
      (investor.payments ?? [])
        .filter((payment: any) => payment.status !== "ACKNOWLEDGED")
        .map((payment: any) => ({
          ...payment,
          investorId: investor.id,
          investorName: investor.name,
          projectName: p.name,
        }))
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Project Portfolio &amp; Capital
        </h1>
        <p className="text-sm text-slate-500">
          Ongoing projects, their subscribing investors, and developer counterparties under
          trusteeship.
        </p>
      </div>

      {/* Pending investor payments banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-amber-700">
          Investor Payments Awaiting Acknowledgement ({pendingPayments.length})
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Each confirmed investor payment must be acknowledged, receipted and notified individually.
        </p>
        {pendingPayments.length === 0 ? (
          <p className="text-xs text-slate-500 mt-2">All received investor payments acknowledged.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {pendingPayments.map((payment: any) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 max-w-2xl"
              >
                <span>
                  {payment.investorName} · {payment.projectName}
                  <span className="block text-[11px] text-slate-500 font-mono">
                    {payment.reference} · {formatNaira(payment.amount)}
                  </span>
                </span>
                <InvestorPaymentAck
                  investorId={payment.investorId}
                  paymentId={payment.id}
                  paymentStatus={payment.status}
                  label="Acknowledge & send receipt"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {projects.map((p) => {
        const committed = p.investors.reduce((s, i) => s + i.committedAmount, 0);
        const dev = p.developers[0];
        return (
          <div
            key={p.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {p.code} · Budget {formatNaira(p.totalBudget)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status as ProjectStatus} />
                {dev && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Developer: {dev.name}
                  </span>
                )}
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Investors</p>
                  <p className="text-slate-900 font-bold mt-1">{p.investors.length}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Capital Committed
                  </p>
                  <p className="text-slate-900 font-bold mt-1">{formatNaira(committed)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Milestone requests
                  </p>
                  <p className="text-slate-900 font-bold mt-1">{p.drawdownRequests.length}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Monitor Assignments
                  </p>
                  <p className="text-slate-900 font-bold mt-1">{p.monitorAssignments.length}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mb-2">Investors Under Project</h3>
              {p.investors.length === 0 ? (
                <p className="text-sm text-slate-500">No investors recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Investor</th>
                        <th className="px-4 py-3">Committed</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Outstanding</th>
                        <th className="px-4 py-3">KYC</th>
                        <th className="px-4 py-3 text-right">Payment action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {p.investors.map((inv: any) => {
                        const payments = inv.payments ?? [];
                        const paid = payments.reduce(
                          (sum: number, payment: any) => sum + payment.amount,
                          0
                        );
                        const outstanding = Math.max(0, inv.committedAmount - paid);
                        const pending = payments.filter(
                          (payment: any) => payment.status !== "ACKNOWLEDGED"
                        );
                        return (
                          <tr key={inv.id} className="align-top">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{inv.name}</p>
                              <p className="text-xs text-slate-500">{inv.email}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-emerald-600">
                              {formatNaira(inv.committedAmount)}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700">
                              {formatNaira(paid)}
                            </td>
                            <td className="px-4 py-3 font-mono text-amber-600">
                              {formatNaira(outstanding)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                                  KYC_STYLES[inv.kycStatus as KycStatus] ?? ""
                                }`}
                              >
                                {inv.kycStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {payments.length === 0 ? (
                                <span className="text-xs text-slate-500">No payments</span>
                              ) : pending.length === 0 ? (
                                <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                                  <CheckCircle2 className="w-4 h-4 mr-1" /> Acknowledged
                                </span>
                              ) : (
                                <div className="space-y-2">
                                  {pending.map((payment: any) => (
                                    <div key={payment.id}>
                                      <p className="text-[11px] text-slate-500 font-mono">
                                        {payment.reference} · {formatNaira(payment.amount)}
                                      </p>
                                      <InvestorPaymentAck
                                        investorId={inv.id}
                                        paymentId={payment.id}
                                        paymentStatus={payment.status}
                                        label="Acknowledge & send receipt"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
