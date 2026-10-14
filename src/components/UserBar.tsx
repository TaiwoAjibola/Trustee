import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  OPS_ANALYST: "Ops Analyst",
  OPS_LEAD: "Ops Lead",
  FIDUCIARY_EXEC: "Fiduciary Exec",
  INDEPENDENT_MONITOR: "Independent Monitor",
};

export async function UserBar() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role?: Role } | undefined)?.role;
  const name = session?.user?.name ?? "Unauthenticated";

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">
          {role ? ROLE_LABELS[role] : "—"}
        </p>
      </div>
      <div className="w-9 h-9 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 text-sm font-bold">
        {name.charAt(0)}
      </div>
      <SignOutButton />
    </div>
  );
}
