"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GateType } from "@prisma/client";
import { submitDrawdownRequest } from "@/actions/fiduciaryActions";
import {
  GATE_LABELS,
} from "@/lib/slaEngine";

export function SubmitDrawdownForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [gate, setGate] = useState<GateType>(GateType.G2_SUBSTRUCTURE);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitDrawdownRequest({
          projectId,
          gateType: gate,
          requestedAmount: amount,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Gate</label>
          <select
            value={gate}
            onChange={(e) => setGate(e.target.value as GateType)}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          >
            {Object.values(GateType).map((g) => (
              <option key={g} value={g}>
                {GATE_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">
            Requested (₦)
          </label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
            required
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || amount <= 0}
        className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit Drawdown Request (Gate G0 required)"}
      </button>
    </form>
  );
}
