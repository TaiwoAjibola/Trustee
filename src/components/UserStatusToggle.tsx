"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserActive } from "@/actions/userActions";
import { Loader2, UserCheck, UserX } from "lucide-react";

export function UserStatusToggle({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await setUserActive(userId, !isActive);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update this user.");
      }
    });
  }

  if (isSelf) {
    return <span className="text-[11px] font-medium text-slate-400">You</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition disabled:opacity-60 ${
          isActive
            ? "border-rose-200 text-rose-600 hover:bg-rose-50"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isActive ? (
          <UserX className="w-3.5 h-3.5" />
        ) : (
          <UserCheck className="w-3.5 h-3.5" />
        )}
        {pending ? "Updating…" : isActive ? "Suspend" : "Activate"}
      </button>
      {error && <p className="text-[11px] text-rose-600 max-w-[180px] text-right">{error}</p>}
    </div>
  );
}
