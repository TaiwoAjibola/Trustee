import { cn } from "@/lib/utils";
import { getSlaStatus } from "@/lib/slaEngine";
import { Clock } from "lucide-react";

export function SlaBadge({ deadline }: { deadline: Date }) {
  const sla = getSlaStatus(deadline);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
        sla.code === "RED"
          ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
          : sla.code === "YELLOW"
            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      )}
    >
      <Clock className="w-3 h-3 mr-1" />
      {sla.label}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-slate-700/50 text-slate-700 border-slate-600/40",
  ACKNOWLEDGED: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  DEFICIENT: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  CERTIFIED_BY_MONITOR: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PAID: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  REJECTED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-semibold border",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
