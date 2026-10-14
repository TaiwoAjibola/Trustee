"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileBarChart,
  UserCircle,
  ShieldCheck,
  ClipboardCheck,
  Landmark,
  Building2,
} from "lucide-react";
import { Role } from "@prisma/client";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ElementType; match?: string };

const TRUSTEE_NAV: NavItem[] = [
  { href: "/ops-dashboard", label: "Dashboard", icon: LayoutDashboard, match: "/ops-dashboard" },
  { href: "/ops-dashboard/monitors", label: "Monitors (KYC)", icon: Users, match: "/monitors" },
  { href: "/reports", label: "Reports", icon: FileBarChart, match: "/reports" },
  {
    href: "/ops-dashboard/profile",
    label: "Profile",
    icon: UserCircle,
    match: "/ops-dashboard/profile",
  },
];

const MONITOR_NAV: NavItem[] = [
  { href: "/monitor-portal", label: "My Assets", icon: Building2, match: "/monitor-portal" },
  {
    href: "/monitor-portal/assignments",
    label: "Certifications",
    icon: ClipboardCheck,
    match: "/assignments",
  },
  { href: "/monitor-portal/profile", label: "My Profile / KYC", icon: UserCircle, match: "/profile" },
];

const ROLE_LABELS: Record<Role, string> = {
  OPS_ANALYST: "Ops Analyst",
  OPS_LEAD: "Ops Lead",
  FIDUCIARY_EXEC: "Fiduciary Exec",
  INDEPENDENT_MONITOR: "Independent Monitor",
};

export type AppUser = { name: string; email?: string | null; role: Role };

export function AppShell({
  role,
  user,
  children,
}: {
  role: Role;
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === Role.INDEPENDENT_MONITOR ? MONITOR_NAV : TRUSTEE_NAV;
  const isMonitor = role === Role.INDEPENDENT_MONITOR;
  const brandColor = isMonitor ? "from-violet-500 to-sky-500" : "from-emerald-500 to-teal-500";
  const initials = (user.name || "U").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div
            className={cn(
              "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-slate-900",
              brandColor
            )}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">SYNDESIS</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {isMonitor ? "Monitor" : "Trustee"} Console
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || (item.match && pathname.startsWith(item.match));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 text-[11px] text-slate-600">
          Fiduciary Control Node · v1
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Landmark className="w-4 h-4" />
            First Trustees · Capital Governance
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                {ROLE_LABELS[role]}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-800 text-sm font-bold">
              {initials}
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
