import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  History,
  BadgeCheck,
} from "lucide-react";


type Capability = { label: string; ok: boolean };

const ROLE_PROFILE: Record<
  Role,
  { title: string; mandate: string; capabilities: Capability[] }
> = {
  FIDUCIARY_EXEC: {
    title: "Trustee",
    mandate:
      "Responsible for the fiduciary control of investor funds. Reviews the Independent Monitor's evidence at each milestone, approves or rejects the funding request, and releases funds only after verification. Also appoints monitors and executes the G10 investor distribution at the 24% p.a. waterfall.",
    capabilities: [
      { label: "Onboard projects & record investor inflows", ok: true },
      { label: "Appoint Independent Monitors to projects", ok: true },
      { label: "Review monitor evidence & milestone reports", ok: true },
      { label: "Approve or reject milestone funding", ok: true },
      { label: "Request additional information (deficiency)", ok: true },
      { label: "Release funds after approval", ok: true },
      { label: "Submit milestone payment requests (Gates G1–G11)", ok: true },
      { label: "Vacate lien & execute investor distribution (G10, 24% p.a.)", ok: true },
    ],
  },
  INDEPENDENT_MONITOR: {
    title: "Independent Monitor",
    mandate:
      "Technical verifier appointed per project. Inspects the site, submits photographic evidence and inspection reports for each milestone, and maintains professional standing — independent of the trustee funding decision.",
    capabilities: [
      { label: "Inspect site & verify physical progress", ok: true },
      { label: "Submit milestone evidence (image / video)", ok: true },
      { label: "Submit inspection findings & reports", ok: true },
      { label: "Maintain professional credential & KYC", ok: true },
      { label: "Sign independence declaration per project", ok: true },
    ],
  },
};

export default async function TrusteeProfilePage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as {
    id: string;
    name?: string;
    email?: string;
    role?: Role;
  } | undefined;
  const role = me?.role ?? Role.FIDUCIARY_EXEC;
  const profile = ROLE_PROFILE[role];

  await mergeOverlayUsersIntoStore();

  const [user, logs] = await Promise.all([
    prisma.user.findUnique({ where: { id: me?.id } }),
    prisma.auditLog.findMany({
      where: { actorId: me?.id },
      orderBy: { timestamp: "desc" },
      take: 12,
      include: { project: { select: { code: true } } },
    }),
  ]);

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">
          First Trustees — role mandate, authorized actions & activity
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Identity */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-xl font-bold text-white">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                {profile.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account status</span>
              <span
                className={`font-semibold ${
                  user?.isActive ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {user?.isActive ? "Active" : "Suspended"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Member since</span>
              <span className="font-medium text-slate-700">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Mandate + capabilities */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-emerald-600" />
              Mandate &amp; Responsibilities
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {profile.mandate}
            </p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Authorized Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.capabilities.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2"
                >
                  {c.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span className={c.ok ? "text-slate-700" : "text-slate-400"}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" />
          My Recent Activity
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No recorded activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {logs.map((log) => (
              <li key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{log.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">
                    {log.project?.code ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
