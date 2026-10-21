/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { calculateInvestorExit } from "@/lib/slaEngine";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { ReconciliationPanel } from "@/components/ReconciliationPanel";
import { DrawdownStatus } from "@prisma/client";
import { GATE_LABELS } from "@/lib/slaEngine";
import { milestoneStatusLabel } from "@/lib/labels";
import {
  Banknote,
  FileBarChart,
  Landmark,
  PiggyBank,
  Scale,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

export default async function ReportsPage() {
  const projects = await prisma.project.findMany({
    include: {
      bankAccounts: true,
      drawdownRequests: { orderBy: { submissionDate: "desc" } },
      cashTransactions: true,
      conditionPrecedent: true,
      investors: { include: { payments: true } },
    },
    orderBy: { name: "asc" },
  });

  const book = projects.reduce(
    (acc, p) => {
      const payments = p.investors.flatMap((inv: any) => inv.payments ?? []);
      acc.committed += p.investors.reduce(
        (sum: number, inv: any) => sum + inv.committedAmount,
        0
      );
      acc.received += payments.reduce((sum: number, pay: any) => sum + pay.amount, 0);
      acc.disbursed += p.drawdownRequests
        .filter((r: any) => r.status === DrawdownStatus.PAID)
        .reduce((sum: number, r: any) => sum + r.requestedAmount, 0);
      acc.custody += p.bankAccounts.reduce((sum: number, a: any) => sum + a.balance, 0);
      return acc;
    },
    { committed: 0, received: 0, disbursed: 0, custody: 0 }
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports &amp; payouts</h1>
        <p className="text-sm text-slate-500">
          Funding position, milestone payment register, investor payment status, exit payout
          schedule and bank matching across the book.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={TrendingUp} label="Total committed" value={formatNaira(book.committed)} />
        <Kpi icon={Banknote} label="Funds received" value={formatNaira(book.received)} tone="emerald" />
        <Kpi icon={Landmark} label="Disbursed to developers" value={formatNaira(book.disbursed)} tone="rose" />
        <Kpi icon={PiggyBank} label="Cash in custody" value={formatNaira(book.custody)} />
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          No projects to report on yet.
        </div>
      ) : (
        projects.map((p: any) => {
          const payments = p.investors.flatMap((inv: any) => inv.payments ?? []);
          const totalCommitted = p.investors.reduce(
            (sum: number, inv: any) => sum + inv.committedAmount,
            0
          );
          const totalReceived = payments.reduce((sum: number, pay: any) => sum + pay.amount, 0);
          const outstanding = Math.max(totalCommitted - totalReceived, 0);
          const unacknowledged = payments.filter(
            (pay: any) => pay.status !== "ACKNOWLEDGED"
          ).length;
          const disbursed = p.drawdownRequests
            .filter((r: any) => r.status === DrawdownStatus.PAID)
            .reduce((sum: number, r: any) => sum + r.requestedAmount, 0);
          const custody = p.bankAccounts.reduce((sum: number, a: any) => sum + a.balance, 0);
          const paidMilestones = p.drawdownRequests.filter(
            (r: any) => r.status === DrawdownStatus.PAID
          ).length;

          const exitRows = p.fundingCloseDate
            ? p.investors.map((inv: any) => ({
                ...inv,
                exit: calculateInvestorExit(inv.committedAmount, p.fundingCloseDate),
              }))
            : [];
          const totalExit = exitRows.reduce(
            (sum: number, row: any) => sum + row.exit.totalPayout,
            0
          );

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {p.code} · {p.status.replace(/_/g, " ")} ·{" "}
                    {paidMilestones}/{p.drawdownRequests.length} milestones paid
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  {p.conditionPrecedent?.lienVacated
                    ? "Lien vacated · exit processing"
                    : "Lien registered"}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Mini label="Committed" value={formatNaira(totalCommitted)} />
                <Mini label="Received" value={formatNaira(totalReceived)} tone="emerald" />
                <Mini
                  label="Outstanding"
                  value={formatNaira(outstanding)}
                  tone={outstanding > 0 ? "amber" : "default"}
                />
                <Mini label="Disbursed" value={formatNaira(disbursed)} tone="rose" />
                <Mini label="Remaining balance" value={formatNaira(custody)} />
                <Mini
                  label="Unacknowledged payments"
                  value={String(unacknowledged)}
                  tone={unacknowledged > 0 ? "amber" : "default"}
                />
              </div>

              {unacknowledged > 0 && (
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  {unacknowledged} investor payment{unacknowledged === 1 ? "" : "s"} still need
                  acknowledgement and a receipt.
                </p>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <FileBarChart className="w-4 h-4 text-sky-600" /> Milestone payment register
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Milestone</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Recipient</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2">Payment date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {p.drawdownRequests.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-3 text-slate-500">
                            No milestone requests.
                          </td>
                        </tr>
                      )}
                      {p.drawdownRequests.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-3 text-slate-800 font-medium">
                            {GATE_LABELS[r.gateType as keyof typeof GATE_LABELS]}
                          </td>
                          <td className="py-2 pr-3 text-slate-500">
                            {milestoneStatusLabel(r.status)}
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-800">
                            {formatNaira(r.requestedAmount)}
                          </td>
                          <td className="py-2 pr-3 text-slate-500">
                            {r.paymentRecipient ?? "—"}
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-500">
                            {r.paymentReference ?? "—"}
                          </td>
                          <td className="py-2 text-slate-500">
                            {r.paymentDate ? formatDateTime(r.paymentDate) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <PiggyBank className="w-4 h-4 text-amber-600" /> Investor exit payout schedule
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    24% p.a. from funding close · total expected{" "}
                    {p.fundingCloseDate ? formatNaira(totalExit) : "—"}
                  </p>
                </div>
                {!p.fundingCloseDate ? (
                  <p className="text-xs text-slate-500">
                    Funding close date has not been declared, so the exit schedule cannot be
                    calculated.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Investor</th>
                          <th className="py-2 pr-3">Principal</th>
                          <th className="py-2 pr-3">Accrued (24% p.a.)</th>
                          <th className="py-2 pr-3">Expected payout</th>
                          <th className="py-2">Exit status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exitRows.map((row: any) => (
                          <tr key={row.id}>
                            <td className="py-2 pr-3 text-slate-800 font-medium">{row.name}</td>
                            <td className="py-2 pr-3 font-mono text-slate-700">
                              {formatNaira(row.exit.principalAmount)}
                            </td>
                            <td className="py-2 pr-3 font-mono text-amber-700">
                              {formatNaira(row.exit.accruedReturn)}
                            </td>
                            <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                              {formatNaira(row.exit.totalPayout)}
                            </td>
                            <td className="py-2 text-slate-500">
                              {p.conditionPrecedent?.lienVacated
                                ? "Lien vacated — payable"
                                : "Held until lien vacated"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <details className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-sky-600" />
                  Match bank transactions
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
  tone?: "default" | "amber" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : tone === "rose"
          ? "text-rose-600"
          : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={`text-xl font-extrabold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "amber" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : tone === "rose"
          ? "text-rose-600"
          : "text-slate-900";
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${toneClass}`}>{value}</p>
    </div>
  );
}
