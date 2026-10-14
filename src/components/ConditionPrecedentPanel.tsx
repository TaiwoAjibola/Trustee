"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConditionPrecedent } from "@/actions/fiduciaryActions";

const CP_ITEMS = [
  { key: "masterScheduleExecuted", label: "Master Trusteeship Framework Executed" },
  { key: "landRegistryLienRegistered", label: "Land Registry Lien Registered" },
  { key: "boqApproved", label: "Approved BoQ & Baseline Programme" },
  { key: "minimumFundingMet", label: "Minimum Funding Threshold Achieved" },
  { key: "insuranceVerified", label: "Insurance Verified" },
] as const;

export function ConditionPrecedentPanel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checks, setChecks] = useState<Record<string, boolean>>(initial);
  const [error, setError] = useState<string | null>(null);

  const allChecked = Object.values(checks).every(Boolean);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateConditionPrecedent({
          projectId,
          masterScheduleExecuted: checks.masterScheduleExecuted,
          landRegistryLienRegistered: checks.landRegistryLienRegistered,
          boqApproved: checks.boqApproved,
          minimumFundingMet: checks.minimumFundingMet,
          insuranceVerified: checks.insuranceVerified,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {CP_ITEMS.map((item) => (
        <label
          key={item.key}
          className="flex items-center justify-between py-2 border-b border-slate-200 text-sm text-slate-700"
        >
          <span>{item.label}</span>
          <input
            type="checkbox"
            checked={!!checks[item.key]}
            onChange={(e) => setChecks((c) => ({ ...c, [item.key]: e.target.checked }))}
            className="accent-sky-500 w-4 h-4"
          />
        </label>
      ))}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !allChecked}
        className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending
          ? "Activating…"
          : allChecked
            ? "Activate Project (Lock Funding Close)"
            : "Check all CPs to Activate"}
      </button>
    </form>
  );
}
