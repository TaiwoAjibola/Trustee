import Link from "next/link";
import { DrawdownStatus, DocumentType } from "@prisma/client";
import { ArrowRight, Camera, FileText, ShieldCheck, XCircle } from "lucide-react";
import { MilestoneStatusBadge, SlaBadge } from "@/components/Badges";
import { DeficiencyDialog } from "@/components/DeficiencyDialog";
import { MilestonePaymentPanel } from "@/components/MilestonePaymentPanel";
import { RejectMilestoneDialog } from "@/components/RejectMilestoneDialog";
import { GATE_LABELS } from "@/lib/slaEngine";
import { formatDateTime, formatNaira } from "@/lib/utils";

type Assignment = {
  id: string;
  monitorId: string;
  status: string;
  assignedAt: Date | string | null;
  monitor: { name: string } | null;
};

type Certificate = {
  id: string;
  monitorId: string;
  notes: string;
  certifiedAt: Date | string | null;
  issuedAt?: Date | string | null;
  estimateAtCompletion?: number | null;
  physicalProgressVerified: boolean;
  varianceFlagged: boolean;
  monitor?: { name: string } | null;
};

type Evidence = {
  id: string;
  documentType: string;
  fileName: string;
  s3Url: string;
};

type Deficiency = {
  id: string;
  consolidatedMessage: string;
  isResolved: boolean;
  issuedAt: Date | string;
};

export function MilestoneCard({
  request,
  projectId,
  assignments,
  certificates,
  documents,
  deficiencies,
  defaultRecipient,
}: {
  request: {
    id: string;
    gateType: keyof typeof GATE_LABELS;
    requestedAmount: number;
    status: DrawdownStatus;
    submissionDate: Date | string;
    slaDeadline: Date | string;
    estimateAtCompletion: number | null;
    reviewComment: string | null;
    paymentRecipient: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    paymentDate: Date | string | null;
  };
  projectId: string;
  assignments: Assignment[];
  certificates: Certificate[];
  documents: Evidence[];
  deficiencies: Deficiency[];
  defaultRecipient: string;
}) {
  const latestReport = [...certificates].sort(
    (a, b) =>
      new Date(b.certifiedAt ?? b.issuedAt ?? 0).getTime() -
      new Date(a.certifiedAt ?? a.issuedAt ?? 0).getTime()
  )[0];
  const openDeficiency = deficiencies.find((d) => !d.isResolved);
  const evidence = documents.filter(
    (doc) =>
      doc.documentType === DocumentType.SITE_PHOTO ||
      doc.documentType === DocumentType.SITE_VIDEO ||
      doc.documentType === DocumentType.CERTIFICATE ||
      doc.documentType === DocumentType.INVOICE
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{GATE_LABELS[request.gateType]}</h3>
            <MilestoneStatusBadge status={request.status} />
            <SlaBadge deadline={request.slaDeadline} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submitted {formatDateTime(request.submissionDate)} · Allocation{" "}
            <span className="font-mono text-slate-900">{formatNaira(request.requestedAmount)}</span>
            {request.estimateAtCompletion ? (
              <> · Monitor EAC {formatNaira(request.estimateAtCompletion)}</>
            ) : null}
          </p>
        </div>
        <Link
          href={`/trustee-dashboard/project/${projectId}/milestone/${request.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
        >
          Open full review <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Assigned independent monitors
          </p>
          {assignments.length === 0 ? (
            <p className="text-xs text-slate-500">
              No monitor is assigned to this milestone yet. Assign a monitor at project level.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((assignment) => {
                const report = certificates.find((c) => c.monitorId === assignment.monitorId);
                return (
                  <li
                    key={assignment.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                  >
                    <span className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-violet-600 mt-0.5" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-900">
                          {assignment.monitor?.name ?? "Independent monitor"}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Assigned {formatDateTime(assignment.assignedAt ?? new Date())}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      {report ? (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          Report {formatDateTime(report.certifiedAt ?? report.issuedAt ?? new Date())}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600">Report pending</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Monitor report & evidence
          </p>
          {latestReport ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-800">
                {latestReport.monitor?.name ?? "Independent monitor"} ·{" "}
                {formatDateTime(latestReport.certifiedAt ?? latestReport.issuedAt ?? new Date())}
              </p>
              <p className="text-xs text-slate-600">{latestReport.notes}</p>
              <p className="text-[11px] text-slate-500">
                Physical progress verified: {latestReport.physicalProgressVerified ? "Yes" : "No"} ·
                Variance flagged: {latestReport.varianceFlagged ? "Yes" : "No"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No monitor report has been submitted for this milestone.
            </p>
          )}
          {evidence.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {evidence.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.s3Url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white border border-slate-200 text-sky-600 hover:text-sky-700"
                >
                  {doc.documentType === DocumentType.SITE_VIDEO ? (
                    <Camera className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {doc.fileName}
                </a>
              ))}
            </div>
          )}
          {openDeficiency && (
            <p className="text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2">
              Open deficiency: {openDeficiency.consolidatedMessage}
            </p>
          )}
          {request.reviewComment && (
            <p className="text-xs rounded-lg bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2">
              <span className="font-semibold">Trustee note:</span> {request.reviewComment}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
        {request.status === DrawdownStatus.CERTIFIED_BY_MONITOR && (
          <>
            <Link
              href={`/trustee-dashboard/project/${projectId}/milestone/${request.id}`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Review &amp; decide
            </Link>
            <RejectMilestoneDialog drawdownRequestId={request.id} />
            <DeficiencyDialog drawdownRequestId={request.id} />
          </>
        )}
        {request.status === DrawdownStatus.APPROVED && (
          <>
            <span className="text-xs font-semibold text-emerald-700">
              Approved — awaiting payment. Payment is recorded separately.
            </span>
            <MilestonePaymentPanel
              drawdownRequestId={request.id}
              approvedAmount={request.requestedAmount}
              defaultRecipient={defaultRecipient}
            />
          </>
        )}
        {request.status === DrawdownStatus.PAID && (
          <div className="text-xs text-slate-600 space-y-0.5">
            <p className="font-semibold text-emerald-700">Payment completed</p>
            <p>
              {request.paymentRecipient ?? "—"} · {request.paymentMethod ?? "—"} ·{" "}
              <span className="font-mono">{request.paymentReference ?? "—"}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Paid {request.paymentDate ? formatDateTime(request.paymentDate) : "—"}
            </p>
          </div>
        )}
        {request.status === DrawdownStatus.REJECTED && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
            <XCircle className="w-4 h-4" /> Rejected — developer must resubmit
          </span>
        )}
        {request.status === DrawdownStatus.SUBMITTED && (
          <span className="text-xs text-slate-500">
            Awaiting a monitor report. Monitors were assigned when the milestone was submitted.
          </span>
        )}
        {request.status === DrawdownStatus.DEFICIENT && (
          <span className="text-xs text-rose-600">
            Corrections requested — reopen after the deficiency is resolved.
          </span>
        )}
      </div>
    </article>
  );
}
