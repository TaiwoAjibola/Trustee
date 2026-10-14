import { KycStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<KycStatus, string> = {
  PENDING: "bg-slate-700/50 text-slate-700 border-slate-600/40",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  VERIFIED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  REJECTED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const STATUS_LABEL: Record<KycStatus, string> = {
  PENDING: "KYC Pending",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "KYC Verified",
  REJECTED: "KYC Rejected",
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border",
        STATUS_STYLE[status]
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {STATUS_LABEL[status]}
    </span>
  );
}
