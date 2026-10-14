"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { certifyMonitorProgress } from "@/actions/fiduciaryActions";

export function MonitorCertifyForm({ drawdownRequestId }: { drawdownRequestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [variance, setVariance] = useState(false);
  const [eac, setEac] = useState(0);
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await certifyMonitorProgress({
          drawdownRequestId,
          physicalProgressVerified: verified,
          varianceFlagged: variance,
          notes,
          estimateAtCompletion: eac,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Certification failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="accent-emerald-500"
        />
        Physical milestone progress verified on site
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={variance}
          onChange={(e) => setVariance(e.target.checked)}
          className="accent-amber-500"
        />
        Cost / schedule variance flagged
      </label>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">
          Estimate at Completion (₦)
        </label>
        <input
          type="number"
          min={0}
          value={eac}
          onChange={(e) => setEac(Number(e.target.value))}
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Certifying…" : "Certify Physical Milestone"}
      </button>
    </form>
  );
}
