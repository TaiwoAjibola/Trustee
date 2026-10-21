import { prisma } from "@/lib/prisma";
import { GATE_LABELS } from "@/lib/slaEngine";
import { ShieldCheck, Camera, FileCheck2, ClipboardCheck } from "lucide-react";
import { MonitorCertifyForm } from "@/components/MonitorCertifyForm";
import { MonitorEvidenceUploader } from "@/components/MonitorEvidenceUploader";
import { SignDeclarationButton } from "@/components/SignDeclarationButton";
import { SlaBadge, StatusBadge } from "@/components/Badges";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DrawdownStatus, DocumentType } from "@prisma/client";
import { formatNaira } from "@/lib/utils";


export default async function MonitorAssignmentsPage() {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as unknown as { id?: string } | undefined)?.id ?? "";

  const myAppointments = await prisma.projectMonitor.findMany({ where: { monitorId: meId } });
  const appointmentByProject = new Map(myAppointments.map((a) => [a.projectId, a]));
  const appointedProjectIds = myAppointments.map((a) => a.projectId);

  const requests = await prisma.drawdownRequest.findMany({
    where: {
      projectId: { in: appointedProjectIds },
      status: { in: [DrawdownStatus.SUBMITTED, DrawdownStatus.DEFICIENT] },
    },
    include: {
      project: true,
      monitorCertificates: true,
      deficiencyNotices: true,
      documents: true,
    },
    orderBy: { submissionDate: "desc" },
  });

  const myAssignments = await prisma.monitorAssignment.findMany({
    where: { monitorId: meId },
    orderBy: { initiatedAt: "desc" },
  });
  const assignmentByRequest = new Map(myAssignments.map((a) => [a.drawdownRequestId, a]));

  const evidenceOf = (reqId: string) =>
    requests
      .find((r) => r.id === reqId)
      ?.documents.filter(
        (d) => d.documentType === DocumentType.SITE_PHOTO || d.documentType === DocumentType.SITE_VIDEO
      ) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Certification Queue</h1>
        <p className="text-sm text-slate-500">
          Verify physical milestones and certify drawdown requests for your appointed projects
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          No drawdown requests awaiting your physical certification.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((req) => {
            const appt = appointmentByProject.get(req.projectId);
            const evidence = evidenceOf(req.id);
            return (
              <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{GATE_LABELS[req.gateType]}</p>
                    <p className="text-xs text-slate-500">{req.project.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-emerald-600 text-sm">
                      {formatNaira(req.requestedAmount)}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Camera className="w-4 h-4" /> SLA Clock: <SlaBadge deadline={req.slaDeadline} />
                </div>

                {assignmentByRequest.get(req.id) && (
                  <p className="text-xs text-violet-600 flex items-center gap-1 bg-violet-500/10 border border-violet-500/30 rounded-md px-2 py-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Initiated by Trustee to verify phase {GATE_LABELS[assignmentByRequest.get(req.id)!.phase]} before disbursement.
                  </p>
                )}

                {req.monitorCertificates.length > 0 && (
                  <p className="text-xs text-violet-600 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Certified {req.monitorCertificates.length}× — EAC:{" "}
                    {req.estimateAtCompletion ? formatNaira(req.estimateAtCompletion) : "—"}
                  </p>
                )}

                {req.deficiencyNotices.some((d) => !d.isResolved) && (
                  <p className="text-xs text-rose-600">
                    Open deficiency notice present — certification should address the consolidated items.
                  </p>
                )}

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Milestone Evidence (image / video)
                  </p>
                  <MonitorEvidenceUploader drawdownRequestId={req.id} />
                  {evidence.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {evidence.map((d) => (
                        <a
                          key={d.id}
                          href={d.s3Url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-sky-600 hover:text-sky-700"
                        >
                          {d.documentType === DocumentType.SITE_VIDEO ? "▶ Video" : "🖼 Photo"}:{" "}
                          {d.fileName.slice(0, 18)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <MonitorCertifyForm drawdownRequestId={req.id} />
                </div>

                {appt && (
                  <div className="border-t border-slate-200 pt-3">
                    <SignDeclarationButton
                      projectId={req.projectId}
                      monitorId={meId}
                      signed={appt.independenceDeclarationSigned}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
