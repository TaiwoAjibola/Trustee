"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { rejectMilestone } from "@/actions/fiduciaryActions";

export function RejectMilestoneDialog({ drawdownRequestId }: { drawdownRequestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectMilestone(drawdownRequestId, reason);
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
      >
        <XCircle className="w-3.5 h-3.5" />
        Reject Milestone
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 w-full max-w-md space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reject this milestone</h3>
              <p className="text-xs text-slate-500 mt-1">
                The developer will be notified with your reasons. This decision is recorded in the
                audit trail.
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why the evidence does not support this funding request..."
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || reason.trim().length < 5}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-50"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
