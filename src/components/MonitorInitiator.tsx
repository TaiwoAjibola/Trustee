"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { initiateMonitorForDrawdown } from "@/actions/fiduciaryActions";

export function MonitorInitiator({
  drawdownRequestId,
  monitorId,
  initiated,
  monitorName,
}: {
  drawdownRequestId: string;
  monitorId: string | null;
  initiated: boolean;
  monitorName?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (initiated) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-violet-600">
        <ShieldCheck className="w-4 h-4 mr-1" /> Monitor Initiated
        {monitorName ? ` · ${monitorName}` : ""}
      </span>
    );
  }

  if (!monitorId) {
    return (
      <span className="text-xs text-slate-400">Appoint a monitor first</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await initiateMonitorForDrawdown(drawdownRequestId, monitorId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Action failed.");
            }
          });
        }}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-60"
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Initiate Independent Monitor
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
