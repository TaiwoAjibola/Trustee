import { prisma } from "@/lib/prisma";
import { GATE_LABELS } from "@/lib/slaEngine";
import Link from "next/link";
import { Building2, ArrowRight, ClipboardCheck, AlertTriangle } from "lucide-react";
import { SlaBadge, StatusBadge } from "@/components/Badges";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DrawdownStatus } from "@prisma/client";


export default async function MonitorAssetsPage() {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as unknown as { id?: string } | undefined)?.id ?? "";

  const appointments = await prisma.projectMonitor.findMany({
    where: { monitorId: meId, removedAt: null },
    include: {
      project: {
        include: {
          drawdownRequests: {
            orderBy: { submissionDate: "desc" },
            include: { monitorCertificates: true, deficiencyNotices: true },
          },
        },
      },
    },
    orderBy: { appointedAt: "desc" },
  });

  const pendingCount = await prisma.drawdownRequest.count({
    where: {
      projectId: { in: appointments.map((a) => a.projectId) },
      status: { in: [DrawdownStatus.SUBMITTED, DrawdownStatus.DEFICIENT] },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assets Under My Monitoring</h1>
          <p className="text-sm text-slate-500">
            Independent physical &amp; financial assurance across your appointed projects
          </p>
        </div>
        {pendingCount > 0 && (
          <Link
            href="/monitor-portal/assignments"
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 bg-violet-500/10 border border-violet-500/30 px-4 py-2 rounded-lg hover:bg-violet-500/20"
          >
            <ClipboardCheck className="w-4 h-4" />
            {pendingCount} certification{pendingCount === 1 ? "" : "s"} pending
          </Link>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          You are not yet appointed to any project. First Trustees will assign you once a project is
          onboarded.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {appointments.map((appt) => {
            const p = appt.project;
            const next = p.drawdownRequests[0];
            const openDeficiency = next?.deficiencyNotices.some((d) => !d.isResolved);
            return (
              <div
                key={appt.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 hover:border-slate-200 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{p.code}</p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                      appt.independenceDeclarationSigned
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {appt.independenceDeclarationSigned ? "Declared" : "Pending Declaration"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-100 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Project</p>
                    <p className="text-slate-800 mt-1">{p.status}</p>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Next Gate</p>
                    <p className="text-slate-800 mt-1">
                      {next ? GATE_LABELS[next.gateType] : "—"}
                    </p>
                  </div>
                </div>

                {next && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <SlaBadge deadline={next.slaDeadline} /> SLA
                    </span>
                    {openDeficiency && (
                      <span className="text-rose-600 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Open deficiency
                      </span>
                    )}
                    <StatusBadge status={next.status} />
                  </div>
                )}

                <Link
                  href="/monitor-portal/assignments"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  Manage Certifications <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
