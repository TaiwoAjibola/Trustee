import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, KycStatus, ProjectStatus } from "@prisma/client";
import { formatNaira } from "@/lib/utils";
import { InvestorPaymentAck } from "@/components/InvestorPaymentAck";
import { StatusBadge } from "@/components/Badges";

const KYC_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-600",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-600",
  PENDING: "bg-slate-500/10 text-slate-500",
  REJECTED: "bg-rose-500/10 text-rose-600",
};

const PAYMENT_STYLES: Record<string, string> = {
  ACKNOWLEDGED: "bg-emerald-500/10 text-emerald-600",
  RECEIVED: "bg-amber-500/10 text-amber-600",
};

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.OPS_ANALYST;

  const projects = await prisma.project.findMany({
    include: {
      bankAccounts: true,
      investors: true,
      developers: true,
      drawdownRequests: { orderBy: { submissionDate: "desc" } },
      monitorAssignments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingPayments = projects
    .flatMap((p) => p.investors.map((i) => ({ ...i, projectName: p.name })))
    .filter((i) => i.paymentStatus === "RECEIVED");

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
          When an investor remits capital, the Trustee confirms and safeguards the inflow into the
          Project Investment trust account.
        </p>
        {pendingPayments.length === 0 ? (
          <p className="text-xs text-slate-500 mt-2">All received investor payments acknowledged.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {pendingPayments.map((i) => (
              <li key={i.id} className="flex justify-between max-w-md">
                <span>{i.name}</span>
                <span className="font-mono text-emerald-600">{formatNaira(i.committedAmount)}</span>
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
                    Live Fund Requests
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
                        <th className="px-4 py-3">KYC</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right">Trustee Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {p.investors.map((inv) => (
                        <tr key={inv.id} className="align-middle">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{inv.name}</p>
                            <p className="text-xs text-slate-500">{inv.email}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-600">
                            {formatNaira(inv.committedAmount)}
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
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                                PAYMENT_STYLES[inv.paymentStatus] ?? ""
                              }`}
                            >
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <InvestorPaymentAck
                              investorId={inv.id}
                              paymentStatus={inv.paymentStatus}
                            />
                          </td>
                        </tr>
                      ))}
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
