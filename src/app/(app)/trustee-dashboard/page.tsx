/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getSlaStatus } from "@/lib/slaEngine";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FileText,
  PlusCircle,
  TriangleAlert,
} from "lucide-react";
import { MilestoneStatusBadge, SlaBadge } from "@/components/Badges";
import { DeficiencyDialog } from "@/components/DeficiencyDialog";
import { RejectMilestoneDialog } from "@/components/RejectMilestoneDialog";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { DrawdownStatus } from "@prisma/client";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { GATE_LABELS } from "@/lib/slaEngine";

export default async function TrusteeDashboardPage() {
  const requests = await prisma.drawdownRequest.findMany({
    include: {
      project: true,
      requestedBy: true,
      monitorCertificates: { include: { monitor: true } },
      documents: true,
      deficiencyNotices: true,
    },
    orderBy: { submissionDate: "desc" },
  });

  const assignments = await prisma.monitorAssignment.findMany({
    include: { monitor: true },
  });
  const assignmentsByRequest = new Map<string, any[]>();
  for (const assignment of assignments) {
    const list = assignmentsByRequest.get(assignment.drawdownRequestId) ?? [];
    list.push(assignment);
    assignmentsByRequest.set(assignment.drawdownRequestId, list);
  }

  const totalInCustody = await prisma.bankAccount.aggregate({
    _sum: { balance: true },
  });

  const reviewQueue = requests.filter(
    (r: any) => r.status === DrawdownStatus.CERTIFIED_BY_MONITOR
  );
  const paymentQueue = requests.filter((r: any) => r.status === DrawdownStatus.APPROVED);
  const monitorQueue = requests.filter(
    (r: any) =>
      r.status === DrawdownStatus.SUBMITTED || r.status === DrawdownStatus.DEFICIENT
  );
  const recentPayments = requests
    .filter((r: any) => r.status === DrawdownStatus.PAID)
    .slice(0, 6);
  const atRisk = requests.filter(
    (r: any) =>
      r.status !== DrawdownStatus.PAID &&
      r.status !== DrawdownStatus.REJECTED &&
      getSlaStatus(r.slaDeadline).code !== "GREEN"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trustee Workspace</h1>
        <p className="text-sm text-slate-500">
          Review monitor reports, approve milestone payments, record payments and keep each
          project record complete.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric
          label="Cash under trusteeship"
          value={formatNaira(totalInCustody._sum.balance || 0)}
          hint="Across all project bank accounts"
        />
        <Metric
          label="Ready for your review"
          value={String(reviewQueue.length)}
          hint="Monitor reports awaiting decision"
          tone="amber"
        />
        <Metric
          label="Approved, awaiting payment"
          value={String(paymentQueue.length)}
          hint="Approval and payment are separate actions"
          tone="sky"
        />
        <Metric
          label="SLA at risk"
          value={String(atRisk)}
          hint="Open milestones past or near deadline"
          tone="rose"
        />
      </div>

      <details className="bg-white border border-slate-200 rounded-xl p-5">
        <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-900">
          <PlusCircle className="w-4 h-4 text-emerald-600" />
          Register new project (Gate G0 — Conditions Precedent)
        </summary>
        <div className="mt-4 max-w-xl">
          <CreateProjectForm />
        </div>
      </details>

      <QueueSection
        title="Needs your review"
        description="A monitor has submitted a report. Approve, reject, or request corrections with a reason."
        empty="No monitor reports are waiting for your decision."
        count={reviewQueue.length}
      >
        {reviewQueue.map((req: any) => (
          <RequestCard
            key={req.id}
            req={req}
            assignments={assignmentsByRequest.get(req.id) ?? []}
            actions={
              <>
                <Link
                  href={`/trustee-dashboard/project/${req.projectId}/milestone/${req.id}`}
                  className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Review & decide <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Link>
                <RejectMilestoneDialog drawdownRequestId={req.id} />
                <DeficiencyDialog drawdownRequestId={req.id} />
              </>
            }
          />
        ))}
      </QueueSection>

      <QueueSection
        title="Approved — awaiting payment"
        description="The decision is recorded. Record the actual payment with a recipient, method and reference."
        empty="No approved milestones are awaiting payment."
        count={paymentQueue.length}
      >
        {paymentQueue.map((req: any) => (
          <RequestCard
            key={req.id}
            req={req}
            assignments={assignmentsByRequest.get(req.id) ?? []}
            actions={
              <Link
                href={`/trustee-dashboard/project/${req.projectId}/milestone/${req.id}`}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Record payment <Banknote className="w-3.5 h-3.5 ml-1" />
              </Link>
            }
          />
        ))}
      </QueueSection>

      <QueueSection
        title="Awaiting monitor report"
        description="The milestone is with the assigned monitors. Use the project workspace to confirm assignments or review evidence."
        empty="No milestones are currently with monitors."
        count={monitorQueue.length}
      >
        {monitorQueue.map((req: any) => (
          <RequestCard
            key={req.id}
            req={req}
            assignments={assignmentsByRequest.get(req.id) ?? []}
            actions={
              <Link
                href={`/trustee-dashboard/project/${req.projectId}/milestone/${req.id}`}
                className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open milestone <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            }
          />
        ))}
      </QueueSection>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed payments
            </h2>
            <p className="text-xs text-slate-500">
              Every completed payment keeps its reference, method, recipient and authorisation.
            </p>
          </div>
          <span className="text-xs text-slate-500">{recentPayments.length} recent</span>
        </div>
        {recentPayments.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No milestone payments completed yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentPayments.map((req: any) => (
              <li
                key={req.id}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <Link
                    href={`/trustee-dashboard/project/${req.projectId}/milestone/${req.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-sky-600"
                  >
                    {GATE_LABELS[req.gateType as keyof typeof GATE_LABELS]} · {req.project.name}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {req.paymentRecipient ?? "Developer"} ·{" "}
                    {req.paymentMethod ?? "Method not recorded"} ·{" "}
                    {req.paymentDate ? formatDateTime(req.paymentDate) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatNaira(req.requestedAmount)}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {req.paymentReference ?? "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QueueSection({
  title,
  description,
  empty,
  count,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {title}
            <span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
              {count}
            </span>
          </h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function RequestCard({
  req,
  assignments,
  actions,
}: {
  req: any;
  assignments: any[];
  actions: React.ReactNode;
}) {
  const reports = [...(req.monitorCertificates ?? [])].sort(
    (a: any, b: any) =>
      new Date(b.certifiedAt ?? b.issuedAt ?? 0).getTime() -
      new Date(a.certifiedAt ?? a.issuedAt ?? 0).getTime()
  );
  const latest = reports[0];
  const evidenceCount = (req.documents ?? []).filter(
    (doc: any) =>
      doc.documentType === "SITE_PHOTO" || doc.documentType === "SITE_VIDEO"
  ).length;
  const openDeficiency = (req.deficiencyNotices ?? []).find(
    (notice: any) => !notice.isResolved
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {GATE_LABELS[req.gateType as keyof typeof GATE_LABELS]}
            </h3>
            <MilestoneStatusBadge status={req.status} />
            <SlaBadge deadline={req.slaDeadline} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {req.project.name} · {req.project.code} · Submitted{" "}
            {formatDateTime(req.submissionDate)}
          </p>
        </div>
        <p className="text-base font-extrabold text-slate-900">
          {formatNaira(req.requestedAmount)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Monitors</p>
          <p className="text-slate-700 mt-0.5">
            {assignments.length > 0
              ? assignments
                  .map((a: any) => a.monitor?.name)
                  .filter(Boolean)
                  .join(", ")
              : "No monitor assigned"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Latest report</p>
          <p className="text-slate-700 mt-0.5">
            {latest
              ? `${latest.monitor?.name ?? "Monitor"} · ${formatDateTime(
                  latest.certifiedAt ?? latest.issuedAt
                )}`
              : "Pending"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Evidence</p>
          <p className="text-slate-700 mt-0.5 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> {evidenceCount} site file
            {evidenceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {latest?.notes && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Monitor note:</span> {latest.notes}
        </p>
      )}

      {openDeficiency && (
        <p className="text-xs text-rose-700 flex items-start gap-1">
          <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Open deficiency: {openDeficiency.consolidatedMessage}
        </p>
      )}

      {req.status === DrawdownStatus.APPROVED && req.reviewComment && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Approval note:</span>{" "}
          {req.reviewComment}
        </p>
      )}

      {req.status === DrawdownStatus.SUBMITTED && assignments.length === 0 && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <Clock3 className="w-3.5 h-3.5" /> Awaiting monitor assignment at project level.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
    </article>
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
  hint: string;
  tone?: "amber" | "sky" | "rose";
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-2xl font-extrabold mt-1 ${
          tone === "amber"
            ? "text-amber-600"
            : tone === "sky"
              ? "text-sky-600"
              : tone === "rose"
                ? "text-rose-600"
                : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <span className="text-[11px] text-slate-500 mt-1 block">{hint}</span>
    </div>
  );
}
