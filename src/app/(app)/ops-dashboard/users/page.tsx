import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { CreateUserForm } from "@/components/CreateUserForm";
import { UserStatusToggle } from "@/components/UserStatusToggle";
import { KycStatusBadge } from "@/components/KycStatusBadge";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  FIDUCIARY_EXEC: "Trustee (Fiduciary Exec)",
  INDEPENDENT_MONITOR: "Independent Monitor",
  OPS_ANALYST: "Ops Analyst",
  OPS_LEAD: "Ops Lead",
};

const ROLE_STYLE: Record<string, string> = {
  FIDUCIARY_EXEC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INDEPENDENT_MONITOR: "bg-violet-50 text-violet-700 border-violet-200",
  OPS_ANALYST: "bg-slate-50 text-slate-600 border-slate-200",
  OPS_LEAD: "bg-slate-50 text-slate-600 border-slate-200",
};

export default async function UserManagementPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; name?: string; role?: Role } | undefined;

  await mergeOverlayUsersIntoStore();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      monitorCredential: true,
      appointedProjects: { include: { project: true } },
    },
  });

  const trustees = users.filter((u) => u.role === Role.FIDUCIARY_EXEC);
  const monitors = users.filter((u) => u.role === Role.INDEPENDENT_MONITOR);
  const active = users.filter((u) => u.isActive);

  const stats = [
    { label: "People", value: users.length, icon: Users },
    { label: "Trustees", value: trustees.length, icon: ShieldCheck },
    { label: "Independent Monitors", value: monitors.length, icon: BadgeCheck },
    { label: "Active accounts", value: active.length, icon: UserCog },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <a
          href="/ops-dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ops Dashboard
        </a>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">
          Attribute Trustee and Independent Monitor roles to people, and manage their
          access to the console.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{s.value}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">
                  {s.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-slate-900">Team directory</h2>
            <span className="text-xs text-slate-500">{users.length} people</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {users.map((u) => {
              const initials = (u.name || "U")
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const isMonitor = u.role === Role.INDEPENDENT_MONITOR;
              const cred = u.monitorCredential;
              const appointments = u.appointedProjects ?? [];

              return (
                <div key={u.id} className="p-4 flex items-start gap-4">
                  <div
                    className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-slate-900 ${
                      isMonitor
                        ? "bg-gradient-to-br from-violet-500 to-sky-500"
                        : "bg-gradient-to-br from-emerald-500 to-teal-500"
                    }`}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{u.name}</p>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 ${
                          ROLE_STYLE[u.role] ?? ROLE_STYLE.OPS_ANALYST
                        }`}
                      >
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      {!u.isActive && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold border border-rose-200 bg-rose-50 text-rose-600 rounded-full px-2 py-0.5">
                          Suspended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>

                    {isMonitor && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <KycStatusBadge status={cred?.kycStatus ?? "PENDING"} />
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <BadgeCheck className="w-3.5 h-3.5 text-slate-400" />
                          {cred
                            ? `${cred.professionalBody} ${cred.registrationNumber}`
                            : "No professional standing"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {appointments.length} project{appointments.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}

                    {isMonitor && appointments.length > 0 && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {appointments.map((a: { project: { name: string } }) => a.project.name).join(", ")}
                      </p>
                    )}
                  </div>

                  <UserStatusToggle
                    userId={u.id}
                    isActive={u.isActive}
                    isSelf={u.id === me?.id}
                  />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            New monitors appear in the{" "}
            <a href="/ops-dashboard/monitors" className="text-sky-600 hover:underline">
              Monitor Registry
            </a>{" "}
            and become selectable when appointing monitors to a project.
          </p>
        </div>

        <div className="lg:col-span-1">
          <CreateUserForm />
        </div>
      </div>
    </div>
  );
}
