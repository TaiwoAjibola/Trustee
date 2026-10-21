import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DrawdownStatus, DocumentType } from "@prisma/client";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AuditLogTimeline } from "@/components/AuditLogTimeline";
import { MilestoneDecisionPanel } from "@/components/MilestoneDecisionPanel";
import { MilestonePaymentPanel } from "@/components/MilestonePaymentPanel";
import { MilestoneStatusBadge, SlaBadge } from "@/components/Badges";
import { GATE_LABELS } from "@/lib/slaEngine";
import { formatDateTime, formatNaira } from "@/lib/utils";

export default async function MilestoneReviewPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id, milestoneId } = await params;

  const [project, request, assignments, auditLogs] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { projectMonitors: { include: { monitor: true } }, developers: true },
    }),
    prisma.drawdownRequest.findUnique({
      where: { id: milestoneId },
      include: {
        requestedBy: true,
        monitorCertificates: { include: { monitor: true } },
        deficiencyNotices: { include: { issuedBy: true } },
        documents: true,
      },
    }),
    prisma.monitorAssignment.findMany({
      where: { drawdownRequestId: milestoneId },
      include: { monitor: true },
    }),
    prisma.auditLog.findMany({
      where: { projectId: id },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  if (!project || !request || request.projectId !== id) notFound();

  const developer = project.developers[0];
  const defaultRecipient = developer
    ? `${developer.name} — ${developer.pocName ?? "Project contact"}`
    : "Project developer";

  const reports = [...request.monitorCertificates].sort(
    (a: { certifiedAt?: Date | string | null; issuedAt?: Date | string | null }, b: { certifiedAt?: Date | string | null; issuedAt?: Date | string | null }) =>
      new Date(b.certifiedAt ?? b.issuedAt ?? 0).getTime() -
      new Date(a.certifiedAt ?? a.issuedAt ?? 0).getTime()
  );
  const latestReport = reports[0];
  const evidence = request.documents.filter(
    (doc: { documentType: string }) =>
      doc.documentType === DocumentType.SITE_PHOTO ||
      doc.documentType === DocumentType.SITE_VIDEO
  );
  const supportingDocs = request.documents.filter(
    (doc: { documentType: string }) =>
      doc.documentType !== DocumentType.SITE_PHOTO &&
      doc.documentType !== DocumentType.SITE_VIDEO
  );
  const openDeficiency = request.deficiencyNotices.find(
    (notice: { isResolved: boolean }) => !notice.isResolved
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/trustee-dashboard/project/${id}#milestones`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to project milestones
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-slate-900">{GATE_LABELS[request.gateType]}</h1>
          <MilestoneStatusBadge status={request.status} />
          <SlaBadge deadline={request.slaDeadline} />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {project.name} · {project.code} · Milestone review and decision
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Summary label="Approved allocation" value={formatNaira(request.requestedAmount)} />
        <Summary
          label="Submitted"
          value={formatDateTime(request.submissionDate)}
          hint={`By ${request.requestedBy?.name ?? "—"}`}
        />
        <Summary
          label="Assigned monitors"
          value={String(assignments.length)}
          hint={assignments.map((a: { monitor: { name: string } | null }) => a.monitor?.name).filter(Boolean).join(", ") || "None"}
        />
        <Summary
          label="Latest report"
          value={latestReport ? formatDateTime(latestReport.certifiedAt ?? latestReport.issuedAt ?? new Date()) : "Pending"}
          hint={latestReport?.monitor?.name ?? "Awaiting monitor"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Milestone summary</h2>
              <p className="text-xs text-slate-500 mt-1">
                {GATE_LABELS[request.gateType]} · {project.name} · Request{" "}
                <span className="font-mono">{request.id.slice(0, 8)}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Fact label="Milestone budget / allocation" value={formatNaira(request.requestedAmount)} />
              <Fact
                label="Monitor estimate at completion"
                value={request.estimateAtCompletion ? formatNaira(request.estimateAtCompletion) : "—"}
              />
              <Fact label="Project status" value={project.status.replace(/_/g, " ")} />
              <Fact label="Developer" value={developer?.name ?? "—"} />
            </div>
            {request.reviewComment && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Current review note
                </p>
                <p className="text-xs text-slate-700 mt-1">{request.reviewComment}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">Assigned monitors & reports</h2>
              <span className="text-[11px] text-slate-500">
                Assignments are managed at project level
              </span>
            </div>
            {assignments.length === 0 ? (
              <p className="text-xs text-slate-500">No monitors assigned to this milestone.</p>
            ) : (
              <ul className="space-y-3">
                {assignments.map((assignment: { id: string; monitorId: string; assignedAt: Date | string | null; status: string; monitor: { name: string; email: string } | null }) => {
                  const report = reports.find(
                    (r: { monitorId: string }) => r.monitorId === assignment.monitorId
                  );
                  return (
                    <li
                      key={assignment.id}
                      className="rounded-lg border border-slate-200 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <ShieldCheck className="w-4 h-4 text-violet-600" />
                          {assignment.monitor?.name ?? "Monitor"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Assigned {formatDateTime(assignment.assignedAt ?? new Date())}
                        </span>
                      </div>
                      {report ? (
                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Report submitted{" "}
                            {formatDateTime(report.certifiedAt ?? report.issuedAt ?? new Date())}
                          </p>
                          <p>{report.notes}</p>
                          <p className="text-[11px] text-slate-500">
                            Physical progress verified: {report.physicalProgressVerified ? "Yes" : "No"} ·
                            Variance flagged: {report.varianceFlagged ? "Yes" : "No"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5" /> Report pending
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Submitted evidence</h2>
            {evidence.length === 0 ? (
              <p className="text-xs text-slate-500">No photographic or video evidence submitted.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {evidence.map((doc: { id: string; fileName: string; s3Url: string; documentType: string }) => (
                  <a
                    key={doc.id}
                    href={doc.s3Url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700 hover:border-sky-400"
                  >
                    <Camera className="w-4 h-4 text-sky-600" />
                    <span>{doc.fileName}</span>
                  </a>
                ))}
              </div>
            )}
            {supportingDocs.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                  Supporting documents
                </p>
                <div className="flex flex-wrap gap-2">
                  {supportingDocs.map((doc: { id: string; fileName: string; s3Url: string }) => (
                    <a
                      key={doc.id}
                      href={doc.s3Url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-sky-600 hover:text-sky-700"
                    >
                      <FileText className="w-3.5 h-3.5" /> {doc.fileName}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Deficiencies & review history</h2>
            {openDeficiency && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold text-rose-700 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Open deficiency
                </p>
                <p className="text-xs text-rose-700 mt-1">{openDeficiency.consolidatedMessage}</p>
                <p className="text-[11px] text-rose-600/80 mt-1">
                  Issued {formatDateTime(openDeficiency.issuedAt)} by {openDeficiency.issuedBy?.name}
                </p>
              </div>
            )}
            {request.deficiencyNotices.length === 0 ? (
              <p className="text-xs text-slate-500">No deficiencies have been issued.</p>
            ) : (
              <ul className="space-y-2">
                {request.deficiencyNotices.map((notice: { id: string; consolidatedMessage: string; isResolved: boolean; issuedAt: Date | string; issuedBy: { name: string } | null }) => (
                  <li
                    key={notice.id}
                    className="text-xs rounded-lg border border-slate-200 p-3"
                  >
                    <p className="font-semibold text-slate-800">
                      {notice.isResolved ? "Resolved" : "Open"} ·{" "}
                      {formatDateTime(notice.issuedAt)}
                    </p>
                    <p className="text-slate-600 mt-1">{notice.consolidatedMessage}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Issued by {notice.issuedBy?.name ?? "Trustee"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Project activity</h2>
            <AuditLogTimeline projectId={id} />
          </section>
        </div>

        <div className="space-y-6">
          <MilestoneDecisionPanel
            drawdownRequestId={request.id}
            projectId={id}
            status={request.status}
            reviewComment={request.reviewComment}
          />

          {request.status === DrawdownStatus.APPROVED && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Payment</h2>
              <p className="text-xs text-slate-500">
                Approval is complete. Recording the payment is a separate, authorised action.
              </p>
              <MilestonePaymentPanel
                drawdownRequestId={request.id}
                approvedAmount={request.requestedAmount}
                defaultRecipient={defaultRecipient}
              />
            </div>
          )}

          {request.status === DrawdownStatus.PAID && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-2">
              <h2 className="text-sm font-bold text-emerald-800">Payment recorded</h2>
              <p className="text-xs text-slate-600">
                {request.paymentRecipient ?? "—"} · {request.paymentMethod ?? "—"}
              </p>
              <p className="text-xs font-mono text-slate-700">
                {request.paymentReference ?? "—"}
              </p>
              <p className="text-[11px] text-slate-500">
                Paid {request.paymentDate ? formatDateTime(request.paymentDate) : "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Recent project audit entries</h2>
        <ul className="space-y-2">
          {auditLogs.slice(0, 8).map((log: { id: string; action: string; actorName: string; details: string; timestamp: Date | string }) => (
            <li key={log.id} className="text-xs border-b border-slate-100 pb-2">
              <p className="font-semibold text-slate-800">
                {log.action.replace(/_/g, " ")} · {log.actorName}
              </p>
              <p className="text-slate-500">{log.details}</p>
              <p className="text-[10px] text-slate-400">{formatDateTime(log.timestamp)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}
