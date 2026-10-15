import { prisma } from "@/lib/prisma";
import { KycStatusBadge } from "@/components/KycStatusBadge";
import { MonitorKycUploader } from "@/components/MonitorKycUploader";
import { MonitorCredentialForm } from "@/components/MonitorCredentialForm";
import { SignDeclarationButton } from "@/components/SignDeclarationButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DocumentType } from "@prisma/client";
import { BadgeCheck, FileText, IdCard, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";


const DOC_META: { type: DocumentType; label: string; icon: typeof FileText }[] = [
  { type: DocumentType.MONITOR_ID, label: "Government ID", icon: IdCard },
  { type: DocumentType.PROFESSIONAL_LICENSE, label: "Professional License", icon: BadgeCheck },
  { type: DocumentType.PI_INSURANCE, label: "Professional Indemnity", icon: ShieldCheck },
  { type: DocumentType.MONITOR_DECLARATION, label: "Independence Declaration", icon: FileText },
];

export default async function MonitorProfilePage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; name?: string; email?: string } | undefined;
  const meId = me?.id ?? "";

  const [credential, docs, appointments] = await Promise.all([
    prisma.monitorCredential.findUnique({ where: { userId: meId } }),
    prisma.documentVault.findMany({ where: { referenceId: meId } }),
    prisma.projectMonitor.findMany({
      where: { monitorId: meId },
      include: { project: true },
    }),
  ]);

  const docByType = new Map(docs.map((d) => [d.documentType, d]));
  const hasStanding = !!credential;
  const hasId = docByType.has(DocumentType.MONITOR_ID);
  const hasLicense = docByType.has(DocumentType.PROFESSIONAL_LICENSE);
  const hasPi = docByType.has(DocumentType.PI_INSURANCE);
  const hasDeclaration = appointments.some((a) => a.independenceDeclarationSigned);
  const steps = [hasStanding, hasId, hasLicense, hasPi, hasDeclaration];
  const progress = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  const initials = (me?.name ?? "M")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-xl font-bold text-slate-900 shadow-lg">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{me?.name}</h1>
          <p className="text-sm text-slate-500">{me?.email}</p>
          <p className="text-[11px] uppercase tracking-wider text-violet-600 mt-1">
            Independent Monitor · Technical Verifier
          </p>
        </div>
        <div className="ml-auto">
          {credential ? (
            <KycStatusBadge status={credential.kycStatus} />
          ) : (
            <KycStatusBadge status={"PENDING" as never} />
          )}
        </div>
      </div>

      {/* Verification progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-md font-bold text-slate-900">KYC &amp; Professional Verification</h2>
          <span className="text-sm font-semibold text-sky-600">{progress}% complete</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {[
            { ok: hasStanding, label: "Standing" },
            { ok: hasId, label: "ID" },
            { ok: hasLicense, label: "License" },
            { ok: hasPi, label: "PI Cover" },
            { ok: hasDeclaration, label: "Declaration" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
            >
              {s.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600" />
              )}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Professional standing */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <BadgeCheck className="w-5 h-5 text-emerald-600 mr-2" />
            Professional Standing
          </h2>
          {credential ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">Registration Body</dt>
                <dd className="text-slate-900 font-semibold">{credential.professionalBody}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">Registration No.</dt>
                <dd className="text-slate-900 font-mono">{credential.registrationNumber}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">PI Insurance</dt>
                <dd className={credential.piInsuranceVerified ? "text-emerald-600 font-semibold" : "text-rose-600"}>
                  {credential.piInsuranceVerified ? "Verified" : "Not verified"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 mb-1">Monitoring Experience</dt>
                <dd className="text-slate-700 text-xs">{credential.experienceSummary}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              No professional standing recorded yet. Add it below.
            </p>
          )}
          <div className="border-t border-slate-200 pt-4">
            <MonitorCredentialForm
              initial={
                credential
                  ? {
                      professionalBody: credential.professionalBody,
                      registrationNumber: credential.registrationNumber,
                      experienceSummary: credential.experienceSummary,
                      piInsuranceVerified: credential.piInsuranceVerified,
                    }
                  : null
              }
            />
          </div>
        </div>

        {/* KYC documents */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-md font-bold text-slate-900 flex items-center">
            <IdCard className="w-5 h-5 text-sky-600 mr-2" />
            KYC Documents
          </h2>
          <div className="space-y-2">
            {DOC_META.map((d) => {
              const doc = docByType.get(d.type);
              const Icon = d.icon;
              return (
                <div
                  key={d.type}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{d.label}</span>
                  </div>
                  {doc ? (
                    <a
                      href={doc.s3Url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-600 hover:text-sky-700"
                    >
                      {doc.fileName.slice(0, 22)} ✓
                    </a>
                  ) : (
                    <span className="text-xs text-rose-600">Missing</span>
                  )}
                </div>
              );
            })}
          </div>
          <MonitorKycUploader />
        </div>
      </div>

      {/* Appointments & declarations */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="text-md font-bold text-slate-900 flex items-center">
          <ShieldCheck className="w-5 h-5 text-violet-600 mr-2" />
          Project Appointments &amp; Independence Declarations
        </h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-slate-500">Not yet appointed to any project.</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{a.project.name}</p>
                  <p className="text-xs text-slate-500">
                    Eligibility met: {a.eligibilityCriteriaMet ? "Yes" : "No"}
                  </p>
                </div>
                <SignDeclarationButton projectId={a.projectId} monitorId={meId} signed={a.independenceDeclarationSigned} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
