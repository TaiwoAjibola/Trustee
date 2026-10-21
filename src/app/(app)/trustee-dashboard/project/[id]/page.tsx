/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { calculateInvestorExit, GATE_LABELS } from "@/lib/slaEngine";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  FileText,
  Landmark,
  Layers,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { MilestoneStatusBadge, StatusBadge } from "@/components/Badges";
import { SubmitDrawdownForm } from "@/components/SubmitDrawdownForm";
import { ConditionPrecedentPanel } from "@/components/ConditionPrecedentPanel";
import { AuditLogTimeline } from "@/components/AuditLogTimeline";
import { MonitorAppointmentPanel } from "@/components/MonitorAppointmentPanel";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";
import { ReconciliationPanel } from "@/components/ReconciliationPanel";
import { RecordInflowForm } from "@/components/RecordInflowForm";
import { VacateLienButton, ExecuteDistributionButton } from "@/components/ProjectLifecycleActions";
import { CommunicationsPanel } from "@/components/CommunicationsPanel";
import { InvestorsSection } from "@/components/InvestorsSection";
import { MilestoneCard } from "@/components/MilestoneCard";
import { ProjectSectionNav } from "@/components/ProjectSectionNav";
import { TransactionsSection } from "@/components/TransactionsSection";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AccountType, DrawdownStatus, Role } from "@prisma/client";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { milestoneStatusLabel } from "@/lib/labels";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      bankAccounts: true,
      conditionPrecedent: true,
      developers: true,
      investors: { include: { payments: true } },
      drawdownRequests: {
        orderBy: { submissionDate: "desc" },
        include: {
          monitorCertificates: { include: { monitor: true } },
          deficiencyNotices: { include: { issuedBy: true } },
          documents: true,
        },
      },
      cashTransactions: { orderBy: { recordedAt: "desc" } },
      auditLogs: { orderBy: { timestamp: "desc" } },
    },
  });

  if (!project) notFound();

  const session = await getServerSession(authOptions);
  const role =
    (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.FIDUCIARY_EXEC;
  const isFiduciary = role === Role.FIDUCIARY_EXEC;

  await mergeOverlayUsersIntoStore();

  const [projectMonitors, monitorUsers, monitorAssignments, notifications, users, documents] =
    await Promise.all([
      prisma.projectMonitor.findMany({ where: { projectId: id }, include: { monitor: true } }),
      prisma.user.findMany({
        where: { role: Role.INDEPENDENT_MONITOR },
        select: { id: true, name: true, email: true },
      }),
      prisma.monitorAssignment.findMany({
        where: { projectId: id },
        include: { monitor: true },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({}),
      prisma.documentVault.findMany({
        where: { drawdownRequestId: { in: project.drawdownRequests.map((r: { id: string }) => r.id) } },
      }),
    ]);

  const activeProjectMonitors = projectMonitors.filter((pm: any) => pm.removedAt == null);
  const appointedIds = activeProjectMonitors.map((pm: { monitorId: string }) => pm.monitorId);
  const availableMonitors = monitorUsers.filter(
    (m: { id: string }) => !appointedIds.includes(m.id)
  );
  const appointments = activeProjectMonitors.map((pm: any) => ({
    monitorId: pm.monitorId,
    name: pm.monitor?.name ?? "Independent monitor",
    email: pm.monitor?.email ?? "",
    eligibilityCriteriaMet: pm.eligibilityCriteriaMet,
    independenceDeclarationSigned: pm.independenceDeclarationSigned,
    appointedAt: pm.appointedAt,
  }));
  const actorNameById = Object.fromEntries(
    users.map((u: { id: string; name: string }) => [u.id, u.name])
  );
  const accountLabelById = Object.fromEntries(
    project.bankAccounts.map((a: any) => [
      a.id,
      `${a.bankName} · ${a.type.replace(/_/g, " ")} (${a.accountNumber})`,
    ])
  );

  const developer = project.developers[0];
  const defaultRecipient = developer
    ? `${developer.name} — ${developer.pocName ?? "Project contact"}`
    : "Project developer";

  const allPayments = project.investors.flatMap((investor: any) =>
    [...(investor.payments ?? [])].sort(
      (a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    )
  );
  const totalFunding = project.investors.reduce(
    (sum: number, inv: any) => sum + inv.committedAmount,
    0
  );
  const fundsReceived = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  const fundsDisbursed = project.drawdownRequests
    .filter((r: any) => r.status === DrawdownStatus.PAID)
    .reduce((sum: number, r: any) => sum + r.requestedAmount, 0);
  const remainingBalance = project.bankAccounts.reduce(
    (sum: number, a: any) => sum + a.balance,
    0
  );
  const currentMilestone =
    project.drawdownRequests.find((r: any) => r.status !== DrawdownStatus.PAID) ??
    project.drawdownRequests[0] ??
    null;

  const investmentAcct = project.bankAccounts.find(
    (a: any) => a.type === AccountType.PROJECT_INVESTMENT_ACCT
  );
  const assetPurchaseAcct = project.bankAccounts.find(
    (a: any) => a.type === AccountType.ASSET_PURCHASE_ACCT
  );
  const executionAcct = project.bankAccounts.find(
    (a: any) => a.type === AccountType.PROJECT_EXECUTION_ACCT
  );

  const exitCalc = project.fundingCloseDate
    ? calculateInvestorExit(investmentAcct?.balance || 0, project.fundingCloseDate)
    : null;

  const cp = project.conditionPrecedent;
  const cpInitial = {
    masterScheduleExecuted: cp?.masterScheduleExecuted ?? false,
    landRegistryLienRegistered: cp?.landRegistryLienRegistered ?? false,
    boqApproved: cp?.boqApproved ?? false,
    minimumFundingMet: cp?.minimumFundingMet ?? false,
    insuranceVerified: cp?.insuranceVerified ?? false,
  };

  const certificationsByMonitor = new Map<string, any[]>();
  for (const request of project.drawdownRequests) {
    for (const cert of request.monitorCertificates ?? []) {
      const list = certificationsByMonitor.get(cert.monitorId) ?? [];
      list.push(cert);
      certificationsByMonitor.set(cert.monitorId, list);
    }
  }

  const milestoneRefs = project.drawdownRequests.map((r: any) => ({
    id: r.id,
    projectId: project.id,
    gateType: GATE_LABELS[r.gateType as keyof typeof GATE_LABELS],
    projectName: project.name,
  }));
  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <Link
          href="/trustee-dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Trustee Workspace
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {project.code} · Project workspace for funding, monitors, milestones and payments
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Current milestone</p>
            <p className="text-sm font-semibold text-slate-900">
              {currentMilestone
                ? GATE_LABELS[currentMilestone.gateType as keyof typeof GATE_LABELS]
                : "—"}
            </p>
            {currentMilestone && (
              <MilestoneStatusBadge status={currentMilestone.status} />
            )}
          </div>
        </div>
      </div>

      <ProjectSectionNav />

      <section id="overview" className="space-y-6 scroll-mt-20">
        <SectionHeader
          icon={<Layers className="w-4 h-4 text-sky-600" />}
          title="Overview"
          description="Funding position, trustee bank accounts, conditions precedent and the current milestone."
        />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Metric label="Project status" value={project.status.replace(/_/g, " ")} />
          <Metric label="Total funding committed" value={formatNaira(totalFunding)} />
          <Metric label="Funds received" value={formatNaira(fundsReceived)} tone="emerald" />
          <Metric label="Funds disbursed" value={formatNaira(fundsDisbursed)} tone="rose" />
          <Metric label="Remaining balance" value={formatNaira(remainingBalance)} />
          <Metric
            label="Current milestone"
            value={
              currentMilestone
                ? GATE_LABELS[currentMilestone.gateType as keyof typeof GATE_LABELS]
                : "—"
            }
            hint={currentMilestone ? milestoneStatusLabel(currentMilestone.status) : undefined}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { label: "Project Investment Account", account: investmentAcct },
            { label: "Asset Purchase Account", account: assetPurchaseAcct },
            { label: "Project Execution Account", account: executionAcct },
          ].map(({ label, account }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                <Landmark className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2">
                {formatNaira(account?.balance || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {account ? `${account.bankName} · ${account.accountNumber}` : "Not provisioned"}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" /> Conditions Precedent (Gate G0)
            </h2>
            <div className="space-y-1 text-xs">
              {[
                ["Master trusteeship framework executed", cpInitial.masterScheduleExecuted],
                ["Land registry lien registered", cpInitial.landRegistryLienRegistered],
                ["Approved BoQ & baseline programme", cpInitial.boqApproved],
                ["Minimum funding threshold achieved", cpInitial.minimumFundingMet],
                ["Insurance verified", cpInitial.insuranceVerified],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between items-center py-1.5 border-b border-slate-100"
                >
                  <span className="text-slate-600">{label}</span>
                  {value ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                      <XCircle className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!cp?.clearedForActivation && (
              <ConditionPrecedentPanel projectId={project.id} initial={cpInitial} />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" /> Investor withdrawals & payouts
            </h2>
            <p className="text-xs text-slate-500">
              Exit rules come from the project&apos;s investment terms. The figures below are the
              current position, not a promise of a payout.
            </p>
            {exitCalc ? (
              <div className="space-y-1.5 text-xs">
                <Row label="Principal capital" value={formatNaira(exitCalc.principalAmount)} />
                <Row
                  label={`Accrual (${exitCalc.elapsedDays} days @ 24% p.a.)`}
                  value={formatNaira(exitCalc.accruedReturn)}
                />
                <Row
                  label="Total exit requirement"
                  value={formatNaira(exitCalc.totalPayout)}
                  strong
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Funding close date not declared. Exit calculator unavailable.
              </p>
            )}
            {isFiduciary && (
              <div className="flex flex-wrap gap-2 pt-1">
                <VacateLienButton projectId={project.id} />
                {cp?.lienVacated && <ExecuteDistributionButton projectId={project.id} />}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="investors" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<Users className="w-4 h-4 text-sky-600" />}
          title="Investors"
          description="Commitments, confirmed payments, outstanding amounts, receipts and payment history for this project."
        />
        <InvestorsSection
          investors={project.investors.map((inv: any) => ({
            ...inv,
            payments: [...(inv.payments ?? [])].sort(
              (a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
            ),
          }))}
        />
      </section>

      <section id="monitors" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<ShieldCheck className="w-4 h-4 text-violet-600" />}
          title="Independent monitors"
          description="Monitors are assigned to the project. Every new milestone is sent to the active monitors without a separate initiation step."
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No monitors assigned yet. Add one or more independent monitors below.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {appointments.map((appointment) => {
                const reports = certificationsByMonitor.get(appointment.monitorId) ?? [];
                const latest = [...reports].sort(
                  (a: any, b: any) =>
                    new Date(b.certifiedAt ?? b.issuedAt ?? 0).getTime() -
                    new Date(a.certifiedAt ?? a.issuedAt ?? 0).getTime()
                )[0];
                return (
                  <div
                    key={appointment.monitorId}
                    className="rounded-lg border border-slate-200 p-3 space-y-1.5"
                  >
                    <p className="text-sm font-semibold text-slate-900">{appointment.name}</p>
                    <p className="text-xs text-slate-500">{appointment.email}</p>
                    <p className="text-[11px] text-slate-500">
                      Assigned {formatDateTime(appointment.appointedAt)}
                    </p>
                    <p
                      className={`text-[11px] font-semibold ${
                        appointment.independenceDeclarationSigned
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {appointment.independenceDeclarationSigned
                        ? "Independence declaration signed"
                        : "Independence declaration pending"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Reports submitted: {reports.length}
                      {latest
                        ? ` · Latest ${formatDateTime(latest.certifiedAt ?? latest.issuedAt)}`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-slate-200 pt-4">
            <MonitorAppointmentPanel
              projectId={project.id}
              available={availableMonitors}
            />
          </div>
        </div>
      </section>

      <section id="milestones" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<Layers className="w-4 h-4 text-emerald-600" />}
          title="Milestones"
          description="Each milestone keeps its report, evidence, decision, approval history and payment record."
        />
        <div className="space-y-4">
          {project.drawdownRequests.length === 0 && (
            <p className="text-sm text-slate-500">No milestone requests on this project yet.</p>
          )}
          {project.drawdownRequests.map((request: any) => (
            <MilestoneCard
              key={request.id}
              projectId={project.id}
              request={{
                id: request.id,
                gateType: request.gateType,
                requestedAmount: request.requestedAmount,
                status: request.status,
                submissionDate: request.submissionDate,
                slaDeadline: request.slaDeadline,
                estimateAtCompletion: request.estimateAtCompletion,
                reviewComment: request.reviewComment,
                paymentRecipient: request.paymentRecipient,
                paymentMethod: request.paymentMethod,
                paymentReference: request.paymentReference,
                paymentDate: request.paymentDate,
              }}
              assignments={monitorAssignments
                .filter((assignment: any) => assignment.drawdownRequestId === request.id)
                .map((assignment: any) => ({
                  id: assignment.id,
                  monitorId: assignment.monitorId,
                  status: assignment.status,
                  assignedAt: assignment.assignedAt ?? assignment.initiatedAt,
                  monitor: assignment.monitor
                    ? { name: assignment.monitor.name }
                    : null,
                }))}
              certificates={(request.monitorCertificates ?? []).map((cert: any) => ({
                id: cert.id,
                monitorId: cert.monitorId,
                notes: cert.notes,
                certifiedAt: cert.certifiedAt ?? cert.issuedAt,
                issuedAt: cert.issuedAt,
                estimateAtCompletion: cert.estimateAtCompletion,
                physicalProgressVerified: cert.physicalProgressVerified,
                varianceFlagged: cert.varianceFlagged,
                monitor: cert.monitor ? { name: cert.monitor.name } : null,
              }))}
              documents={request.documents ?? []}
              deficiencies={request.deficiencyNotices ?? []}
              defaultRecipient={defaultRecipient}
            />
          ))}
        </div>

        {cp?.clearedForActivation && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Request milestone payment
            </p>
            {appointments.length === 0 && (
              <p className="text-xs text-amber-600 mb-2">
                Assign at least one independent monitor before submitting a milestone.
              </p>
            )}
            <SubmitDrawdownForm projectId={project.id} />
          </div>
        )}
      </section>

      <section id="transactions" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<Banknote className="w-4 h-4 text-emerald-600" />}
          title="Transactions"
          description="Where money came from, where it went, and the reference, method and authorisation behind each record."
        />
        <TransactionsSection
          transactions={project.cashTransactions}
          milestones={milestoneRefs}
          accountLabelById={accountLabelById}
          actorNameById={actorNameById}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <ReconciliationPanel projectId={project.id} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" /> Record investor payment
            </h2>
            <p className="text-xs text-slate-500">
              Record a confirmed payment into the designated trust account. This creates a ledger
              transaction; it does not acknowledge an investor payment automatically.
            </p>
            <RecordInflowForm
              projectId={project.id}
              accounts={project.bankAccounts.map((a: any) => ({
                id: a.id,
                type: a.type,
                accountNumber: a.accountNumber,
              }))}
            />
          </div>
        </div>
      </section>

      <section id="documents" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<FileText className="w-4 h-4 text-sky-600" />}
          title="Documents & project information"
          description="Monitor reports, milestone evidence, invoices, certificates, payment receipts and investor communications."
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-4">Document</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Milestone</th>
                    <th className="py-2 pr-4">Uploaded</th>
                    <th className="py-2 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {documents.map((doc: any) => {
                    const milestone = project.drawdownRequests.find(
                      (r: any) => r.id === doc.drawdownRequestId
                    );
                    return (
                      <tr key={doc.id}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{doc.fileName}</td>
                        <td className="py-2 pr-4 text-slate-500">
                          {String(doc.documentType).replace(/_/g, " ")}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">
                          {milestone
                            ? GATE_LABELS[milestone.gateType as keyof typeof GATE_LABELS]
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">
                          {formatDateTime(doc.uploadedAt)}
                        </td>
                        <td className="py-2 text-right">
                          <a
                            href={doc.s3Url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-600 hover:text-sky-700 font-semibold"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Payment receipts</h3>
            {project.drawdownRequests.filter((r: any) => r.status === DrawdownStatus.PAID)
              .length === 0 ? (
              <p className="text-xs text-slate-500">No milestone payments recorded yet.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {project.drawdownRequests
                  .filter((r: any) => r.status === DrawdownStatus.PAID)
                  .map((r: any) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2">
                      <span className="text-slate-600">
                        {GATE_LABELS[r.gateType as keyof typeof GATE_LABELS]} ·{" "}
                        {r.paymentRecipient ?? "Developer"}
                      </span>
                      <span className="font-mono text-slate-900">
                        {r.paymentReference ?? "—"} · {formatNaira(r.requestedAmount)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Investor communications</h3>
            <CommunicationsPanel notifications={notifications} />
          </div>
        </div>
      </section>

      <section id="activity" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<ShieldCheck className="w-4 h-4 text-slate-500" />}
          title="Activity & audit history"
          description="Who submitted, reviewed, approved, rejected, paid or changed a record, and when."
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <AuditLogTimeline projectId={project.id} />
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`text-base font-bold mt-1 ${
          tone === "emerald"
            ? "text-emerald-600"
            : tone === "rose"
              ? "text-rose-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t border-slate-200 pt-1.5 font-bold text-slate-900" : "text-slate-500"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
