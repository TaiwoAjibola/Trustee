"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewMonitorKyc } from "@/actions/fiduciaryActions";
import { KycStatus } from "@prisma/client";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function ReviewKycButton({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (status: KycStatus) =>
    startTransition(async () => {
      setError(null);
      try {
        await reviewMonitorKyc({ monitorId, status });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed.");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => act(KycStatus.VERIFIED)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> Verify
      </button>
      <button
        onClick={() => act(KycStatus.UNDER_REVIEW)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-60"
      >
        <Clock className="w-3.5 h-3.5" /> Re-review
      </button>
      <button
        onClick={() => act(KycStatus.REJECTED)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-60"
      >
        <XCircle className="w-3.5 h-3.5" /> Reject
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  );
}
