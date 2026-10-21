"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appointMonitor } from "@/actions/fiduciaryActions";
import { UserPlus, ChevronDown } from "lucide-react";

export function MonitorAppointmentPanel({
  projectId,
  available,
}: {
  projectId: string;
  available: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [eligibility, setEligibility] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function appoint() {
    setError(null);
    startTransition(async () => {
      try {
        for (const mid of selected) {
          await appointMonitor({
            projectId,
            monitorId: mid,
            eligibilityCriteriaMet: eligibility,
          });
        }
        setSelected([]);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Appointment failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-sky-500 outline-none"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {selected.length
              ? `${selected.length} monitor(s) selected`
              : "Select monitor(s) to appoint"}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto p-2 space-y-2">
              {available.length === 0 ? (
                <p className="text-xs text-slate-500 p-2">
                  All available monitors are already appointed.
                </p>
              ) : (
                available.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 cursor-pointer text-sm rounded-md"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => toggle(m.id)}
                      className="accent-violet-500"
                    />
                    <span>
                      <span className="font-medium text-slate-900">{m.name}</span>
                      <span className="block text-xs text-slate-500">{m.email}</span>
                    </span>
                  </label>
                ))
              )}
              {available.length > 0 && (
                <div className="border-t border-slate-200 pt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={eligibility}
                      onChange={(e) => setEligibility(e.target.checked)}
                      className="accent-sky-500"
                    />
                    Meets Master-level eligibility criteria
                  </label>
                  <button
                    type="button"
                    disabled={pending || selected.length === 0}
                    onClick={appoint}
                    className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-4 text-sm disabled:opacity-60"
                  >
                    {pending ? "Appointing…" : `Appoint ${selected.length ? selected.length : ""} Monitor(s)`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">
        Monitor fees are borne by First Trustees (cost tracked on the cash ledger).
      </p>
    </div>
  );
}
