"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DrawdownStatus } from "@prisma/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { approveMilestone } from "@/actions/fiduciaryActions";
import { DeficiencyDialog } from "@/components/DeficiencyDialog";
import { RejectMilestoneDialog } from "@/components/RejectMilestoneDialog";

export function MilestoneDecisionPanel({
  drawdownRequestId,
  projectId,
  status,
  reviewComment,
}: {
  drawdownRequestId: string;
  projectId: string;
  status: DrawdownStatus;
  reviewComment?: string | null;
}) {
  const router = useRouter();
  const [comment, setComment] = useState(reviewComment ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canDecide = status === DrawdownStatus.CERTIFIED_BY_MONITOR;

  function approve() {
    setError(null);
    startTransition(async () => {
      try {
        await approveMilestone(drawdownRequestId, comment);
        router.push(`/trustee-dashboard/project/${projectId}#milestones`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed.");
      }
    });
  }

  if (status === DrawdownStatus.APPROVED || status === DrawdownStatus.PAID) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {status === DrawdownStatus.APPROVED
            ? "Milestone approved — awaiting payment"
            : "Milestone payment completed"}
        </p>
        {reviewComment && (
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Approval comment:</span> {reviewComment}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Approval makes the milestone eligible for payment. Payment is recorded separately in the
          project transactions.
        </p>
      </div>
    );
  }

  if (status === DrawdownStatus.REJECTED) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
        <p className="text-sm font-semibold text-rose-800">This milestone was rejected</p>
        <p className="text-xs text-slate-600 mt-1">
          The developer must correct the submission and submit a new milestone payment request.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Trustee decision</h3>
        <p className="text-xs text-slate-500 mt-1">
          Review the monitor report and evidence above before deciding. Approval makes the milestone
          eligible for the payment process; it does not move money.
        </p>
      </div>

      {status === DrawdownStatus.DEFICIENT && (
        <p className="text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2">
          Corrections were requested. The milestone will return to review after the developer and
          monitor resubmit.
        </p>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Approval comment
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Record what you reviewed and why the milestone is approved..."
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={pending || !canDecide}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Approve milestone for payment
        </button>
        <RejectMilestoneDialog drawdownRequestId={drawdownRequestId} />
        <DeficiencyDialog drawdownRequestId={drawdownRequestId} />
      </div>

      {!canDecide && (
        <p className="text-[11px] text-slate-500">
          A monitor report is required before approval. You can still reject or request corrections.
        </p>
      )}
    </div>
  );
}
