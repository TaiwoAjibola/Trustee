"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role, DrawdownStatus } from "@prisma/client";
import {
  acknowledgeDrawdown,
  recommendDrawdown,
  approveAndPayDrawdown,
  resolveDeficiency,
} from "@/actions/fiduciaryActions";

export function ApprovalActions({
  drawdownRequestId,
  status,
  role,
}: {
  drawdownRequestId: string;
  status: DrawdownStatus;
  role: Role;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  };

  const isTrustee =
    role === Role.OPS_ANALYST ||
    role === Role.OPS_LEAD ||
    role === Role.FIDUCIARY_EXEC;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === DrawdownStatus.SUBMITTED && isTrustee && (
          <button
            onClick={() => run(() => acknowledgeDrawdown(drawdownRequestId))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-60"
          >
            Acknowledge (Ops)
          </button>
        )}
        {status === DrawdownStatus.ACKNOWLEDGED && role === Role.OPS_LEAD && (
          <button
            onClick={() => run(() => recommendDrawdown(drawdownRequestId))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-60"
          >
            Verify & Recommend (Ops Lead)
          </button>
        )}
        {status === DrawdownStatus.APPROVED && role === Role.FIDUCIARY_EXEC && (
          <button
            onClick={() => run(() => approveAndPayDrawdown(drawdownRequestId))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
          >
            Approve & Pay (Fiduciary Exec)
          </button>
        )}
        {status === DrawdownStatus.DEFICIENT && isTrustee && (
          <button
            onClick={() => run(() => resolveDeficiency(drawdownRequestId))}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-60"
          >
            Mark Resolved & Reopen
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
