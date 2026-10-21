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
  CheckCircle2,
  FileBarChart,
  Landmark,
  MessageSquare,
  PiggyBank,
  Scale,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";

export default async function ReportsPage() {
  const projects = await prisma.project.findMany({
    include: {
      bankAccounts: true,
      drawdownRequests: {
        orderBy: { submissionDate: "desc" },
        include: { deficiencyNotices: true, monitorCertificates: true },
      },
      cashTransactions: true,
      conditionPrecedent: true,
      investors: { include: { payments: true } },
      sourceMilestones: true,
      projectMonitors: { include: { monitor: true } },
      investorAnnouncements: true,
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
      acc.pendingPayments += payments.filter((pay: any) => pay.status !== "ACKNOWLEDGED").length;
      acc.pendingReviews += p.drawdownRequests.filter((r: any) =>
        [DrawdownStatus.SUBMITTED, DrawdownStatus.CERTIFIED_BY_MONITOR].includes(r.status)
      ).length;
      acc.openDeficiencies += p.drawdownRequests.reduce(
        (sum: number, r: any) =>
          sum + (r.deficiencyNotices ?? []).filter((n: any) => !n.isResolved).length,
        0
      );
      acc.milestonesPaid += p.drawdownRequests.filter(
        (r: any) => r.status === DrawdownStatus.PAID
      ).length;
      acc.milestonesTotal += p.sourceMilestones.length;
      acc.monitors += p.projectMonitors.filter((pm: any) => pm.removedAt == null).length;
      acc.announcements += p.investorAnnouncements.length;
      acc.announcementsFailed += p.investorAnnouncements.filter(
        (a: any) => a.failedCount > 0
      ).length;
      return acc;
    },
    {
      committed: 0,
      received: 0,
      disbursed: 0,
      custody: 0,
      pendingPayments: 0,
      pendingReviews: 0,
      openDeficiencies: 0,
      milestonesPaid: 0,
      milestonesTotal: 0,
      monitors: 0,
      announcements: 0,
      announcementsFailed: 0,
    }
  );

  const allPayments = projects.flatMap((p: any) =>
    p.investors.flatMap((investor: any) =>
      (investor.payments ?? []).map((payment: any) => ({
        ...payment,
        investorName: investor.name,
        investorEmail: investor.email,
        projectName: p.name,
      }))
    )
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
        <Kpi
          icon={CheckCircle2}
          label="Milestones paid"
          value={`${book.milestonesPaid} / ${book.milestonesTotal}`}
          hint={`${book.milestonesTotal ? Math.round((book.milestonesPaid / book.milestonesTotal) * 100) : 0}% of source programme`}
        />
        <Kpi
          icon={FileBarChart}
          label="Reviews in progress"
          value={String(book.pendingReviews)}
          hint="Submitted or monitor-certified"
          tone={book.pendingReviews > 0 ? "amber" : "default"}
        />
        <Kpi
          icon={TriangleAlert}
          label="Open exceptions"
          value={String(book.pendingPayments + book.openDeficiencies)}
          hint={`${book.pendingPayments} payment confirmations · ${book.openDeficiencies} deficiencies`}
          tone={book.pendingPayments + book.openDeficiencies > 0 ? "amber" : "default"}
        />
        <Kpi
          icon={MessageSquare}
          label="Investor communications"
          value={String(book.announcements)}
          hint={`${book.announcementsFailed} with failed deliveries`}
          tone={book.announcementsFailed > 0 ? "amber" : "default"}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-sky-600" /> Portfolio at a glance
            </h2>
            <p className="text-xs text-slate-500">
              Funding, disbursement, milestone and exception position for every project.
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {book.monitors} active
            monitor appointments
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4">Project</th>
                <th className="py-2.5 pr-4">Committed</th>
                <th className="py-2.5 pr-4">Received</th>
                <th className="py-2.5 pr-4">Outstanding</th>
                <th className="py-2.5 pr-4">Disbursed</th>
                <th className="py-2.5 pr-4">Custody</th>
                <th className="py-2.5 pr-4">Milestones</th>
                <th className="py-2.5 pr-4">Exceptions</th>
                <th className="py-2.5 px-4">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {projects.map((p: any) => {
                const payments = p.investors.flatMap((inv: any) => inv.payments ?? []);
                const committed = p.investors.reduce(
                  (sum: number, inv: any) => sum + inv.committedAmount,
                  0
                );
                const received = payments.reduce((sum: number, pay: any) => sum + pay.amount, 0);
                const disbursed = p.drawdownRequests
                  .filter((r: any) => r.status === DrawdownStatus.PAID)
                  .reduce((sum: number, r: any) => sum + r.requestedAmount, 0);
                const custody = p.bankAccounts.reduce(
                  (sum: number, a: any) => sum + a.balance,
                  0
                );
                const paid = p.drawdownRequests.filter(
                  (r: any) => r.status === DrawdownStatus.PAID
                ).length;
                const total = p.sourceMilestones.length;
                const pct = total ? Math.round((paid / total) * 100) : 0;
                const exceptions =
                  payments.filter((pay: any) => pay.status !== "ACKNOWLEDGED").length +
                  p.drawdownRequests.reduce(
                    (sum: number, r: any) =>
                      sum + (r.deficiencyNotices ?? []).filter((n: any) => !n.isResolved).length,
                    0
                  );
                return (
                  <tr key={p.id}>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="font-mono text-[10px] text-slate-500">{p.code}</p>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-700">
                      {formatNaira(committed)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-emerald-600">
                      {formatNaira(received)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-amber-600">
                      {formatNaira(Math.max(committed - received, 0))}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-rose-600">
                      {formatNaira(disbursed)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-700">
                      {formatNaira(custody)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {paid} / {total}
                      <span className="block text-[10px] text-slate-500">paid</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-semibold ${exceptions > 0 ? "text-amber-600" : "text-slate-500"}`}
                      >
                        {exceptions}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        payments + deficiencies
                      </span>
                    </td>
                    <td className="py-2.5 px-4 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="text-[10px] text-slate-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Investor payment register
          </h2>
          <p className="text-xs text-slate-500">
            Every payment confirmed by the source application, with acknowledgement and receipt
            status. Confirmation is event-driven, not a manual trustee action.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4">Payment date</th>
                <th className="py-2.5 pr-4">Investor</th>
                <th className="py-2.5 pr-4">Project</th>
                <th className="py-2.5 pr-4">Amount</th>
                <th className="py-2.5 pr-4">Reference</th>
                <th className="py-2.5 pr-4">Method</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 px-4">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-slate-500">
                    No investor payments recorded.
                  </td>
                </tr>
              )}
              {allPayments.map((payment: any) => (
                <tr key={payment.id}>
                  <td className="py-2.5 px-4 text-slate-500">
                    {formatDateTime(payment.paidAt)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-slate-900">{payment.investorName}</p>
                    <p className="text-[10px] text-slate-500">{payment.investorEmail ?? "—"}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{payment.projectName}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-900">
                    {formatNaira(payment.amount)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-slate-600">{payment.reference}</td>
                  <td className="py-2.5 pr-4 text-slate-600">
                    {(payment.method ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        payment.status === "ACKNOWLEDGED"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {payment.status === "ACKNOWLEDGED" ? "Confirmed" : "Awaiting source"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-emerald-700">
                    {payment.receiptRef ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
          const sourceMilestonesCompleted = p.sourceMilestones.filter(
            (milestone: any) => milestone.sourceStatus === "COMPLETED"
          ).length;
          const sourceProgress = p.sourceMilestones.length
            ? Math.round((sourceMilestonesCompleted / p.sourceMilestones.length) * 100)
            : 0;
          const activeMonitors = p.projectMonitors.filter(
            (appointment: any) => appointment.removedAt == null
          ).length;
          const announcements = p.investorAnnouncements ?? [];
          const failedDeliveries = announcements.reduce(
            (sum: number, item: any) => sum + (item.failedCount ?? 0),
            0
          );

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
                    {p.code} · {p.status.replace(/_/g, " ")} · {paidMilestones} trustee
                    payment{paidMilestones === 1 ? "" : "s"} ·{" "}
                    {sourceMilestonesCompleted}/{p.sourceMilestones.length} source milestones
                    complete
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
                  label="Awaiting source confirmation"
                  value={String(unacknowledged)}
                  tone={unacknowledged > 0 ? "amber" : "default"}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Source programme progress
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${sourceProgress}%` }}
                      />
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{sourceProgress}%</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {sourceMilestonesCompleted} of {p.sourceMilestones.length} milestones complete
                    at source
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Monitor coverage
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {activeMonitors} active appointment{activeMonitors === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {p.drawdownRequests.reduce(
                      (sum: number, r: any) => sum + (r.monitorCertificates?.length ?? 0),
                      0
                    )}{" "}
                    monitor reports on record
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Investor communications
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {announcements.length} announcement{announcements.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {failedDeliveries === 0
                      ? "No failed deliveries"
                      : `${failedDeliveries} failed deliver${failedDeliveries === 1 ? "y" : "ies"} need retry`}
                  </p>
                </div>
              </div>

              {unacknowledged > 0 && (
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  {unacknowledged} investor payment{unacknowledged === 1 ? "" : "s"} are awaiting
                  confirmation from the source application. Receipts are issued automatically on
                  confirmation.
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
  hint,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
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
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
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
