import { prisma } from "@/lib/prisma";
import { KycStatusBadge } from "@/components/KycStatusBadge";
import { ReviewKycButton } from "@/components/ReviewKycButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, DocumentType } from "@prisma/client";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";
import { BadgeCheck, IdCard, ShieldCheck, ArrowLeft } from "lucide-react";


export default async function MonitorsDirectoryPage() {
  const session = await getServerSession(authOptions);
  const role =
    (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.OPS_ANALYST;

  await mergeOverlayUsersIntoStore();

  const monitors = await prisma.user.findMany({
    where: { role: Role.INDEPENDENT_MONITOR },
    include: {
      monitorCredential: true,
      appointedProjects: { include: { project: true } },
    },
    orderBy: { name: "asc" },
  });

  const monitorIds = monitors.map((m) => m.id);
  const docs = monitorIds.length
    ? await prisma.documentVault.findMany({ where: { referenceId: { in: monitorIds } } })
    : [];
  const docsByMonitor = new Map<string, typeof docs>();
  for (const d of docs) {
    const list = docsByMonitor.get(d.referenceId) ?? [];
    list.push(d);
    docsByMonitor.set(d.referenceId, list);
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <a
          href="/ops-dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ops Dashboard
        </a>
        <h1 className="text-2xl font-bold text-slate-900">Independent Monitor Registry</h1>
        <p className="text-sm text-slate-500">
          First Trustees KYC review, professional standing &amp; appointment oversight
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {monitors.map((m) => {
          const cred = m.monitorCredential;
          const docTypes = new Set((docsByMonitor.get(m.id) ?? []).map((d) => d.documentType));
          const initials = m.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center font-bold text-slate-900">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
                <div className="ml-auto">
                  {cred ? (
                    <KycStatusBadge status={cred.kycStatus} />
                  ) : (
                    <KycStatusBadge status={"PENDING" as never} />
                  )}
                </div>
              </div>

              {/* Standing summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {cred ? (
                    <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <IdCard className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="text-slate-700">
                    {cred ? `${cred.professionalBody} ${cred.registrationNumber}` : "No standing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-700">
                    PI: {cred?.piInsuranceVerified ? "Verified" : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <IdCard className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-700">
                    Docs: {[DocumentType.MONITOR_ID, DocumentType.PROFESSIONAL_LICENSE, DocumentType.PI_INSURANCE].filter((t) => docTypes.has(t)).length}/3
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-700">
                    Appointed: {m.appointedProjects.length} project(s)
                  </span>
                </div>
              </div>

              {m.appointedProjects.length > 0 && (
                <p className="text-xs text-slate-500">
                  {m.appointedProjects.map((a) => a.project.name).join(", ")}
                </p>
              )}

              {role !== Role.INDEPENDENT_MONITOR && (
                <div className="border-t border-slate-200 pt-3">
                  <ReviewKycButton monitorId={m.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
