import { prisma } from "@/lib/prisma";
import { calculateInvestorExit, GATE_LABELS } from "@/lib/slaEngine";
import { notFound } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Landmark,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { SlaBadge, StatusBadge } from "@/components/Badges";
import { SubmitDrawdownForm } from "@/components/SubmitDrawdownForm";
import { ConditionPrecedentPanel } from "@/components/ConditionPrecedentPanel";
import { AuditLogTimeline } from "@/components/AuditLogTimeline";
import { AppointMonitorForm } from "@/components/AppointMonitorForm";
import { ReconciliationPanel } from "@/components/ReconciliationPanel";
import { RecordInflowForm } from "@/components/RecordInflowForm";
import { VacateLienButton, ExecuteDistributionButton } from "@/components/ProjectLifecycleActions";
import { TrusteeWorkflowStepper } from "@/components/TrusteeWorkflowStepper";
import { CommunicationsPanel } from "@/components/CommunicationsPanel";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, AccountType } from "@prisma/client";
import { formatNaira } from "@/lib/utils";


export default async function ProjectLedgerPage({
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
      drawdownRequests: { orderBy: { submissionDate: "desc" } },
      auditLogs: { orderBy: { timestamp: "desc" } },
    },
  });

  if (!project) notFound();

  const session = await getServerSession(authOptions);
  const role =
    (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.OPS_ANALYST;
  const isFiduciary = role === Role.FIDUCIARY_EXEC;

  const [projectMonitor, monitorUsers, monitorAssignments, notifications] = await Promise.all([
    prisma.projectMonitor.findFirst({ where: { projectId: id } }),
    prisma.user.findMany({
      where: { role: Role.INDEPENDENT_MONITOR },
      select: { id: true, name: true, email: true },
    }),
    prisma.monitorAssignment.findMany({ where: { projectId: id } }),
    prisma.notification.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const investmentAcct = project.bankAccounts.find(
    (a) => a.type === AccountType.PROJECT_INVESTMENT_ACCT
  );
  const assetPurchaseAcct = project.bankAccounts.find(
    (a) => a.type === AccountType.ASSET_PURCHASE_ACCT
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <a
          href="/ops-dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ops Dashboard
        </a>
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        <p className="text-sm text-slate-500">
          Project Fiduciary Ledger & Control Gate History · {project.code}
        </p>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Project Investment Account
            </span>
            <Landmark className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-4">
            {formatNaira(investmentAcct?.balance || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            AccNo: {investmentAcct?.accountNumber} ({investmentAcct?.bankName})
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Asset Purchase Account (50% Deposits)
            </span>
            <Landmark className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-4">
            {formatNaira(assetPurchaseAcct?.balance || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            AccNo: {assetPurchaseAcct?.accountNumber} ({assetPurchaseAcct?.bankName})
          </p>
        </div>
      </div>

      {/* Gate G0 Checklist & Gate G10 Exit Waterfall */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CP Check */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <ShieldCheck className="w-5 h-5 text-sky-600 mr-2" />
            Conditions Precedent (Gate G0) Status
          </h2>

          <div className="space-y-2 text-sm">
            {[
              { label: "Master Trusteeship Framework Executed", val: cpInitial.masterScheduleExecuted },
              { label: "Land Registry Lien Registered", val: cpInitial.landRegistryLienRegistered },
              { label: "Approved BoQ & Baseline Programme", val: cpInitial.boqApproved },
              { label: "Minimum Funding Threshold Achieved", val: cpInitial.minimumFundingMet },
              { label: "Insurance Verified", val: cpInitial.insuranceVerified },
            ].map((cpItem, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-2 border-b border-slate-200"
              >
                <span className="text-slate-700">{cpItem.label}</span>
                {cpItem.val ? (
                  <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Cleared
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-semibold text-rose-600">
                    <XCircle className="w-4 h-4 mr-1" /> Pending
                  </span>
                )}
              </div>
            ))}
          </div>

          {!project.conditionPrecedent?.clearedForActivation && (
            <div className="pt-2">
              <ConditionPrecedentPanel projectId={project.id} initial={cpInitial} />
            </div>
          )}
        </div>

        {/* Gate G10 Calculator */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <Layers className="w-5 h-5 text-amber-600 mr-2" />
            Gate G10 Investor Exit Waterfall
          </h2>

          {exitCalc ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Principal Capital</span>
                <span className="font-mono text-slate-900">
                  {formatNaira(exitCalc.principalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Accrual Period</span>
                <span className="font-mono text-slate-900">
                  {exitCalc.elapsedDays} Days (@ 24% p.a.)
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Accrued Yield</span>
                <span className="font-mono text-emerald-600">
                  {formatNaira(exitCalc.accruedReturn)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                <span>Total Investor Exit Requirement</span>
                <span className="font-mono text-amber-600">
                  {formatNaira(exitCalc.totalPayout)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Project Funding Close Date not declared. Exit calculator offline.
            </p>
          )}
        </div>
      </div>

      {/* Drawdown Gates for this project */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-md font-bold text-slate-900">Gate History (G1–G11)</h2>
        <div className="space-y-3">
          {project.drawdownRequests.length === 0 && (
            <p className="text-sm text-slate-500">No drawdown requests on this project yet.</p>
          )}
          {project.drawdownRequests.map((req) => {
            const assignment =
              monitorAssignments.find((a) => a.drawdownRequestId === req.id) ?? null;
            const monitorId = projectMonitor?.monitorId ?? null;
            const monitorName = projectMonitor
              ? monitorUsers.find((m) => m.id === projectMonitor.monitorId)?.name
              : undefined;
            return (
              <div
                key={req.id}
                className="border border-slate-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {GATE_LABELS[req.gateType]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatNaira(req.requestedAmount)} · {req.id.slice(0, 8)}
                  </p>
                  <SlaBadge deadline={req.slaDeadline} />
                  <StatusBadge status={req.status} />
                </div>
                <TrusteeWorkflowStepper
                  request={req}
                  monitorAssignment={assignment}
                  monitorId={monitorId}
                  monitorName={monitorName}
                  role={role}
                />
              </div>
            );
          })}
        </div>

        {project.conditionPrecedent?.clearedForActivation && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Submit New Drawdown (Gate G0 Cleared)
            </p>
            <SubmitDrawdownForm projectId={project.id} />
          </div>
        )}
      </div>

      {/* Monitor Appointment & Independence (First Trustees) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-md font-bold text-slate-900 flex items-center">
          <ShieldCheck className="w-5 h-5 text-violet-600 mr-2" />
          Independent Monitor Appointment
        </h2>
        {projectMonitor ? (
          <div className="text-sm text-slate-700 space-y-1">
            <p>
              Appointed Monitor:{" "}
              <span className="text-slate-900 font-semibold">{monitorUsers.find((m) => m.id === projectMonitor.monitorId)?.name ?? projectMonitor.monitorId}</span>
            </p>
            <p>
              Master-level eligibility met:{" "}
              <span className={projectMonitor.eligibilityCriteriaMet ? "text-emerald-600" : "text-rose-600"}>
                {projectMonitor.eligibilityCriteriaMet ? "Yes" : "No"}
              </span>
            </p>
            <p>
              Independence &amp; conflict declaration:{" "}
              <span className={projectMonitor.independenceDeclarationSigned ? "text-emerald-600" : "text-amber-600"}>
                {projectMonitor.independenceDeclarationSigned ? "Signed" : "Pending signature by Monitor"}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Monitor fees are borne by First Trustees (cost tracked on the cash ledger).
            </p>
          </div>
        ) : (
          <AppointMonitorForm projectId={project.id} monitors={monitorUsers} />
        )}
      </div>

      {/* Reconciliation & Inflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <ReconciliationPanel projectId={project.id} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <Landmark className="w-5 h-5 text-emerald-600 mr-2" />
            Record Safeguarded Inflow
          </h2>
          <p className="text-xs text-slate-500">
            First Trustees receive &amp; safeguard Project Investment subscriptions and Asset
            Purchase collections into the designated trust accounts.
          </p>
          <RecordInflowForm
            projectId={project.id}
            accounts={project.bankAccounts.map((a) => ({
              id: a.id,
              type: a.type,
              accountNumber: a.accountNumber,
            }))}
          />
        </div>
      </div>

      {/* Exit & Investor Distribution (Fiduciary Exec) */}
      {isFiduciary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <Layers className="w-5 h-5 text-amber-600 mr-2" />
            Investor Exit &amp; Distribution
          </h2>
          <p className="text-xs text-slate-500">
            Upon final sale / investor exit, First Trustees vacates the registered lien and
            administers the 24% p.a. waterfall to Project Investors.
          </p>
          <div className="flex flex-wrap gap-3">
            <VacateLienButton projectId={project.id} />
            {project.conditionPrecedent?.lienVacated && (
              <ExecuteDistributionButton projectId={project.id} />
            )}
          </div>
        </div>
      )}

      {/* Communications & Receipts */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-md font-bold text-slate-900 flex items-center">
          <Landmark className="w-5 h-5 text-sky-600 mr-2" />
          Developer Feedback &amp; Investor Receipts
        </h2>
        <p className="text-xs text-slate-500">
          Outbound communications issued by First Trustees — drawdown receipts to the developer,
          phase-confirmation feedback, and capital-safeguarding notices to investors.
        </p>
        <CommunicationsPanel notifications={notifications} />
      </div>

      {/* Audit Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-md font-bold text-slate-900">Audit Log</h2>
        <AuditLogTimeline projectId={project.id} />
      </div>
    </div>
  );
}
