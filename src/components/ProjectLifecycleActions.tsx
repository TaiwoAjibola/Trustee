"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vacateLien, executeInvestorDistribution } from "@/actions/fiduciaryActions";
import { KeyRound, Banknote } from "lucide-react";

export function VacateLienButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await vacateLien(projectId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed.");
            }
          })
        }
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-60"
      >
        <KeyRound className="w-3.5 h-3.5 inline mr-1" />
        {pending ? "Vacating…" : "Vacate Lien & Mark Exit"}
      </button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

export function ExecuteDistributionButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await executeInvestorDistribution(projectId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed.");
            }
          })
        }
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-60"
      >
        <Banknote className="w-3.5 h-3.5 inline mr-1" />
        {pending ? "Executing…" : "Execute Investor Distribution (24% p.a.)"}
      </button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
