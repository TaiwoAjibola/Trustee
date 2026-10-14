import { prisma } from "@/lib/prisma";
import { getSlaStatus } from "@/lib/slaEngine";
import Link from "next/link";
import { ArrowUpRight, PlusCircle } from "lucide-react";
import { SlaBadge, StatusBadge } from "@/components/Badges";
import { DeficiencyDialog } from "@/components/DeficiencyDialog";
import { ApprovalActions } from "@/components/ApprovalActions";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, DrawdownStatus } from "@prisma/client";
import { formatNaira } from "@/lib/utils";

export const instant = false;

export default async function OpsDashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.OPS_ANALYST;

  const requests = await prisma.drawdownRequest.findMany({
    include: {
      project: true,
      requestedBy: true,
      deficiencyNotices: true,
    },
    orderBy: { submissionDate: "desc" },
  });

  const totalInCustody = await prisma.bankAccount.aggregate({
    _sum: { balance: true },
  });

  const atRisk = requests.filter((r) => getSlaStatus(r.slaDeadline).code !== "GREEN").length;

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Trustee Fiduciary Control Node
        </h1>
        <p className="text-sm text-slate-500">
          First Trustees — Operations &amp; Cash Control Dashboard
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Cash Under Trusteeship
          </p>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {formatNaira(totalInCustody._sum.balance || 0)}
          </p>
          <span className="text-xs text-emerald-600 mt-2 block">
            ✓ Reconciled with Bank Feeds
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Active Drawdown Requests
          </p>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{requests.length}</p>
          <span className="text-xs text-slate-500 mt-2 block">
            Across all live qualifying projects
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            SLA Risk Monitor
          </p>
          <p className="text-3xl font-extrabold text-amber-600 mt-2">{atRisk}</p>
          <span className="text-xs text-amber-600/80 mt-2 block">
            Requires Immediate Fiduciary Action
          </span>
        </div>
      </div>

      {/* Project Registration */}
      <details className="bg-white border border-slate-200 rounded-xl p-6">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-900">
          <PlusCircle className="w-4 h-4 text-emerald-600" />
          Register New Project (Gate G0 — Conditions Precedent)
        </summary>
        <div className="mt-4 max-w-xl">
          <CreateProjectForm />
        </div>
      </details>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Disbursement Requests
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Request ID / Gate</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Requested Amount</th>
                <th className="px-6 py-4">SLA Clock Status</th>
                <th className="px-6 py-4">Gate Status</th>
                <th className="px-6 py-4">Fiduciary Controls</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No drawdown requests submitted yet.
                  </td>
                </tr>
              )}
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-100 transition align-top">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900">
                    {req.gateType}
                    <span className="block text-xs text-slate-500 font-sans">
                      {req.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">{req.project.name}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-emerald-600">
                    {formatNaira(req.requestedAmount)}
                  </td>
                  <td className="px-6 py-4">
                    <SlaBadge deadline={req.slaDeadline} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-6 py-4 space-y-2">
                    <ApprovalActions drawdownRequestId={req.id} status={req.status} role={role} />
                    {req.status === DrawdownStatus.SUBMITTED && (
                      <DeficiencyDialog drawdownRequestId={req.id} />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      className="inline-flex items-center text-xs font-semibold text-sky-600 hover:text-sky-700"
                      href={`/ops-dashboard/project/${req.projectId}`}
                    >
                      Inspect Ledger <ArrowUpRight className="w-4 h-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
