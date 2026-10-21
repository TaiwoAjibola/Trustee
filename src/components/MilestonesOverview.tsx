import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Layers } from "lucide-react";
import type { SourceMilestone } from "@/lib/sourceApi";
import { formatDateTime, formatNaira } from "@/lib/utils";

const SOURCE_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-500/10 text-slate-600",
  IN_PROGRESS: "bg-sky-500/10 text-sky-700",
  WORK_COMPLETED: "bg-amber-500/10 text-amber-700",
  COMPLETED: "bg-emerald-500/10 text-emerald-700",
  CANCELLED: "bg-rose-500/10 text-rose-700",
};

const REVIEW_STYLES: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-700",
  APPROVED: "bg-sky-500/10 text-sky-700",
  CERTIFIED_BY_MONITOR: "bg-violet-500/10 text-violet-700",
  SUBMITTED: "bg-amber-500/10 text-amber-700",
  DEFICIENT: "bg-rose-500/10 text-rose-700",
  REJECTED: "bg-rose-500/10 text-rose-700",
};

export function MilestonesOverview({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: SourceMilestone[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2.5 px-4">Milestone</th>
              <th className="py-2.5 pr-4">Source status</th>
              <th className="py-2.5 pr-4">Amount</th>
              <th className="py-2.5 pr-4">Trustee review</th>
              <th className="py-2.5 pr-4">Monitors</th>
              <th className="py-2.5 pr-4">Source updated</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {milestones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-5 text-slate-500">
                  No milestones have been received from the source application.
                </td>
              </tr>
            )}
            {milestones.map((milestone) => {
              const review = milestone.review;
              return (
                <tr key={milestone.id} className="align-top hover:bg-slate-50/60">
                  <td className="py-3 px-4 min-w-[230px]">
                    <p className="font-semibold text-slate-900">{milestone.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {milestone.externalId}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.min(100, Math.max(0, milestone.progressPct))}%` }}
                        />
                      </span>
                      <span className="text-[10px] text-slate-500">{milestone.progressPct}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        SOURCE_STYLES[milestone.sourceStatus] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {milestone.sourceStatusLabel}
                    </span>
                    {milestone.completedAt && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {formatDateTime(milestone.completedAt)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-900">
                    {formatNaira(milestone.amount)}
                  </td>
                  <td className="py-3 pr-4">
                    {review ? (
                      <>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            REVIEW_STYLES[review.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {review.statusLabel}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {review.reportCount} report{review.reportCount === 1 ? "" : "s"} ·{" "}
                          {review.documentCount} document{review.documentCount === 1 ? "" : "s"}
                        </span>
                        {review.openDeficiency && (
                          <span className="mt-1 block text-[10px] font-semibold text-rose-600">
                            Deficiency open
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Not submitted
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {review?.monitors.length ? (
                      review.monitors.map((monitor) => (
                        <span key={monitor.id} className="block text-[11px]">
                          {monitor.name ?? "Independent monitor"}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">No monitor assigned</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {formatDateTime(milestone.sourceUpdatedAt)}
                    {milestone.dueAt && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" /> Due {formatDateTime(milestone.dueAt)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {review ? (
                      <Link
                        href={`/trustee-dashboard/project/${projectId}/milestone/${review.drawdownRequestId}`}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                          review.canReview
                            ? "bg-sky-600 text-white hover:bg-sky-500"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {review.canReview
                          ? "Review"
                          : review.status === "APPROVED"
                            ? "Record payment"
                            : "View details"}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <Layers className="w-3 h-3" /> Source only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-200 px-4 py-2.5 text-[10px] text-slate-500">
        Milestone names, amounts, progress and source statuses come from the originating
        application. Trustee decisions and payment status are recorded locally and never overwrite
        the source record.
      </p>
    </div>
  );
}
