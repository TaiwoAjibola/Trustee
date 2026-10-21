/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { calculateInvestorExit, GATE_LABELS } from "@/lib/slaEngine";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  FileText,
  Landmark,
  Layers,
  MessageSquare,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { MilestoneStatusBadge, StatusBadge } from "@/components/Badges";
import { ConditionPrecedentPanel } from "@/components/ConditionPrecedentPanel";
import { AuditLogTimeline } from "@/components/AuditLogTimeline";
import { MonitorAppointmentPanel } from "@/components/MonitorAppointmentPanel";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";
import { ReconciliationPanel } from "@/components/ReconciliationPanel";
import { VacateLienButton, ExecuteDistributionButton } from "@/components/ProjectLifecycleActions";
import { InvestorsSection } from "@/components/InvestorsSection";
import { MilestonesOverview } from "@/components/MilestonesOverview";
import { CommunicationsCentre } from "@/components/CommunicationsCentre";
import { ProjectSectionNav } from "@/components/ProjectSectionNav";
import { TransactionsSection } from "@/components/TransactionsSection";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AccountType, DrawdownStatus, Role } from "@prisma/client";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { milestoneStatusLabel } from "@/lib/labels";
import {
  getProjectInvestorPayments,
  getProjectMilestones,
  SOURCE_STATUS_LABELS,
  type SourceInvestorPayment,
  type SourceMilestone,
  type SourceStatus,
} from "@/lib/sourceApi";

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

  const [
    projectMonitors,
    monitorUsers,
    monitorAssignments,
    announcements,
    developerMessages,
    users,
    documents,
  ] = await Promise.all([
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
    prisma.investorAnnouncement.findMany({
      where: { projectId: id },
      orderBy: { sentAt: "desc" },
    }),
    prisma.developerMessage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({}),
    prisma.documentVault.findMany({
      where: { drawdownRequestId: { in: project.drawdownRequests.map((r: { id: string }) => r.id) } },
    }),
  ]);

  const buildMilestoneReview = (request: any): SourceMilestone["review"] => ({
    drawdownRequestId: request.id,
    status: request.status,
    statusLabel: milestoneStatusLabel(request.status),
    submittedAt: request.submissionDate,
    slaDeadline: request.slaDeadline,
    reviewComment: request.reviewComment ?? null,
    openDeficiency:
      (request.deficiencyNotices ?? []).find((notice: any) => !notice.isResolved)
        ?.consolidatedMessage ?? null,
    canReview: request.status === DrawdownStatus.CERTIFIED_BY_MONITOR,
    paymentReference: request.paymentReference ?? null,
    paymentDate: request.paymentDate ?? null,
    reportCount: (request.monitorCertificates ?? []).length,
    documentCount: (request.documents ?? []).length,
    monitors: monitorAssignments
      .filter((assignment: any) => assignment.drawdownRequestId === request.id)
      .map((assignment: any) => ({
        id: assignment.monitorId,
        name: assignment.monitor?.name ?? null,
        email: assignment.monitor?.email ?? null,
      })),
  });

  let milestones: SourceMilestone[] = [];
  let sourceMilestoneMeta: { fetchedAt: string; source: string } | null = null;
  let paymentsFromSource: SourceInvestorPayment[] = [];
  let paymentsAreFromSource = false;
  let sourcePaymentMeta: { fetchedAt: string; source: string } | null = null;
  const integrationErrors: string[] = [];

  try {
    const payload = await getProjectMilestones(id);
    milestones = payload.data.map((milestone) => {
      const request = project.drawdownRequests.find(
        (candidate: any) => candidate.sourceMilestoneId === milestone.id
      );
      return {
        ...milestone,
        review: request ? buildMilestoneReview(request) : null,
      };
    });
    sourceMilestoneMeta = { fetchedAt: payload.fetchedAt, source: payload.source };
  } catch (error) {
    integrationErrors.push(
      `Milestones: ${error instanceof Error ? error.message : "source unavailable"}. Showing locally cached review records instead.`
    );
    milestones = project.drawdownRequests.map((request: any) => {
      const sourceStatus: SourceStatus =
        request.status === DrawdownStatus.PAID
          ? "COMPLETED"
          : request.status === DrawdownStatus.CERTIFIED_BY_MONITOR ||
              request.status === DrawdownStatus.APPROVED
            ? "WORK_COMPLETED"
            : "IN_PROGRESS";
      return {
        id: request.sourceMilestoneId ?? request.id,
        externalId: `LOCAL-${String(request.id).slice(-8).toUpperCase()}`,
        gateType: request.gateType,
        name: GATE_LABELS[request.gateType as keyof typeof GATE_LABELS],
        description: null,
        amount: request.requestedAmount,
        currency: "NGN",
        sourceStatus,
        sourceStatusLabel: SOURCE_STATUS_LABELS[sourceStatus],
        progressPct: sourceStatus === "COMPLETED" ? 100 : 50,
        dueAt: request.slaDeadline,
        completedAt: request.paymentDate ?? null,
        sourceUpdatedAt: request.updatedAt ?? request.submissionDate,
        review: buildMilestoneReview(request),
      };
    }) as SourceMilestone[];
  }

  try {
    const payload = await getProjectInvestorPayments(id);
    const localById = new Map(
      project.investors
        .flatMap((investor: any) => investor.payments ?? [])
        .map((payment: any) => [payment.id, payment])
    );
    paymentsFromSource = payload.data.map((payment) => {
      const local = localById.get(payment.id) as
        | { status?: string; acknowledgedAt?: string; receiptRef?: string; notificationStatus?: string }
        | undefined;
      return local?.status === "ACKNOWLEDGED"
        ? {
            ...payment,
            status: local.status,
            acknowledgedAt: local.acknowledgedAt ?? payment.acknowledgedAt,
            receiptRef: local.receiptRef ?? payment.receiptRef,
            notificationStatus: local.notificationStatus ?? payment.notificationStatus,
          }
        : payment;
    });
    paymentsAreFromSource = true;
    sourcePaymentMeta = { fetchedAt: payload.fetchedAt, source: payload.source };
  } catch (error) {
    integrationErrors.push(
      `Investor payments: ${error instanceof Error ? error.message : "source unavailable"}. Showing the last local confirmation records instead.`
    );
  }

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

  const localPayments = project.investors.flatMap((investor: any) =>
    [...(investor.payments ?? [])].sort(
      (a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    )
  );
  const allPayments = paymentsAreFromSource ? paymentsFromSource : localPayments;
  const investorsWithPayments = project.investors.map((investor: any) => ({
    ...investor,
    payments: paymentsAreFromSource
      ? paymentsFromSource.filter((payment) => payment.investorId === investor.id)
      : [...(investor.payments ?? [])].sort(
          (a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
        ),
  }));
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

      {integrationErrors.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4" /> Source application unavailable
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
            {integrationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-amber-700">
            Do not treat the figures below as current source-of-truth data until the connection is
            restored and the page is refreshed.
          </p>
        </div>
      )}

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

      <section id="milestones" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<Layers className="w-4 h-4 text-emerald-600" />}
          title="Milestones"
          description="The complete milestone programme is received read-only from the originating application. Trustees review evidence and record decisions locally without recreating source records."
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {milestones.length} milestone{milestones.length === 1 ? "" : "s"} received
            {sourceMilestoneMeta
              ? ` from ${sourceMilestoneMeta.source} at ${formatDateTime(sourceMilestoneMeta.fetchedAt)}`
              : " · local fallback view"}
          </span>
          <span className="inline-flex items-center gap-1">
            Source status and trustee review status are shown separately.
          </span>
        </div>
        <MilestonesOverview projectId={project.id} milestones={milestones} />
      </section>

      <section id="investors" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<Users className="w-4 h-4 text-sky-600" />}
          title="Investors"
          description="Commitments, payments confirmed by the source application, outstanding amounts, receipts and payment history for this project."
        />
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-[11px] text-slate-600">
          Payments are read from the source application. Receipts and investor notifications are
          triggered by a confirmed payment event; the trustee does not re-enter or manually
          acknowledge payments here.
          {sourcePaymentMeta
            ? ` Last source sync ${formatDateTime(sourcePaymentMeta.fetchedAt)}.`
            : ""}
        </div>
        <InvestorsSection investors={investorsWithPayments} />
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" /> Source payment records
            </h2>
            <p className="text-xs text-slate-500">
              Investor payments are captured by the originating application and applied here
              automatically. This workspace no longer records or acknowledges investor payments
              manually, so the ledger and the source application stay aligned.
            </p>
            <p className="text-[11px] text-slate-500">
              {paymentsAreFromSource
                ? `${allPayments.length} payment record${allPayments.length === 1 ? "" : "s"} received from the source application.`
                : "Source payments are currently unavailable. Local confirmation records are shown for reference only."}
            </p>
            <p className="text-[11px] text-slate-500">
              Milestone disbursements below are trustee-authorised payments and remain subject to
              the review workflow.
            </p>
          </div>
        </div>
      </section>

      <section id="documents" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<FileText className="w-4 h-4 text-sky-600" />}
          title="Documents & project information"
          description="Monitor reports, milestone evidence, invoices, certificates and payment receipts. Communications live in the dedicated Communications section."
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

        </div>
      </section>

      <section id="communications" className="scroll-mt-20 space-y-3">
        <SectionHeader
          icon={<MessageSquare className="w-4 h-4 text-violet-600" />}
          title="Communications"
          description="Send investor notifications with delivery history, and keep a structured conversation with the developer."
        />
        <CommunicationsCentre
          projectId={project.id}
          announcements={announcements}
          messages={developerMessages}
          milestones={project.drawdownRequests.map((request: any) => ({
            id: request.id,
            name: GATE_LABELS[request.gateType as keyof typeof GATE_LABELS],
          }))}
          investorCount={investorsWithPayments.length}
        />
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
