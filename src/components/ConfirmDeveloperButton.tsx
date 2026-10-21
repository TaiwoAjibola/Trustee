"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { confirmAndNotifyDeveloper } from "@/actions/fiduciaryActions";

export function ConfirmDeveloperButton({
  drawdownRequestId,
  certified,
  alreadyActioned,
}: {
  drawdownRequestId: string;
  certified: boolean;
  alreadyActioned: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alreadyActioned) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
        Milestone approved
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await confirmAndNotifyDeveloper(drawdownRequestId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Action failed.");
            }
          });
        }}
        disabled={pending || !certified}
        title={!certified ? "Independent Monitor must verify and submit evidence first" : undefined}
        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-50"
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Approve Milestone
      </button>
      {!certified && (
        <span className="text-[11px] text-slate-400">Awaiting monitor verification</span>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
