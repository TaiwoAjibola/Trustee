import { prisma } from "@/lib/prisma";
import { calculateInvestorExit } from "@/lib/slaEngine";
import { formatNaira } from "@/lib/utils";
import { ReconciliationPanel } from "@/components/ReconciliationPanel";
import { DrawdownStatus } from "@prisma/client";
import { FileBarChart, TrendingUp, Landmark, Scale, PiggyBank } from "lucide-react";

export const instant = false;

export default async function ReportsPage() {
  const projects = await prisma.project.findMany({
    include: {
      bankAccounts: true,
      drawdownRequests: { where: { status: DrawdownStatus.PAID } },
      cashTransactions: true,
      conditionPrecedent: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports &amp; Reconciliation</h1>
        <p className="text-sm text-slate-500">
          Capital deployment, trust reconciliation, and investor-exit (G10) waterfall across the book
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          No projects to report on yet.
        </div>
      ) : (
        projects.map((p) => {
          const capitalDeployed = p.drawdownRequests.reduce((s, d) => s + d.requestedAmount, 0);
          const cashInCustody = p.bankAccounts.reduce((s, a) => s + a.balance, 0);
          const exit = calculateInvestorExit(capitalDeployed, p.fundingCloseDate ?? new Date());
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
                  <p className="text-xs text-slate-500 font-mono">{p.code}</p>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Kpi icon={TrendingUp} label="Capital Deployed" value={formatNaira(capitalDeployed)} />
                <Kpi icon={Landmark} label="Cash in Custody" value={formatNaira(cashInCustody)} />
                <Kpi
                  icon={PiggyBank}
                  label="G10 Accrued (24% p.a.)"
                  value={formatNaira(exit.accruedReturn)}
                  tone="amber"
                />
                <Kpi
                  icon={FileBarChart}
                  label="G10 Total Payout"
                  value={formatNaira(exit.totalPayout)}
                  tone="emerald"
                />
              </div>

              <details className="bg-slate-100 border border-slate-200 rounded-xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-sky-600" />
                  Trustee ↔ Bank Reconciliation
                </summary>
                <div className="mt-4">
                  <ReconciliationPanel projectId={p.id} />
                </div>
              </details>
            </div>
          );
        })
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="bg-slate-100 rounded-lg p-4">
      <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={`text-xl font-extrabold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
