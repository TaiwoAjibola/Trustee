"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertMonitorCredential } from "@/actions/fiduciaryActions";

export function MonitorCredentialForm({
  initial,
}: {
  initial?: {
    professionalBody: string;
    registrationNumber: string;
    experienceSummary?: string | null;
    piInsuranceVerified: boolean;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(initial?.professionalBody ?? "COREN");
  const [reg, setReg] = useState(initial?.registrationNumber ?? "");
  const [exp, setExp] = useState(initial?.experienceSummary ?? "");
  const [pi, setPi] = useState(initial?.piInsuranceVerified ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await upsertMonitorCredential({
          professionalBody: body,
          registrationNumber: reg,
          experienceSummary: exp,
          piInsuranceVerified: pi,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">
            Professional Body
          </label>
          <select
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          >
            <option value="COREN">COREN</option>
            <option value="NIQS">NIQS</option>
            <option value="ARCON">ARCON</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">
            Registration No.
          </label>
          <input
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            required
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">
          Monitoring Experience
        </label>
        <textarea
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={pi}
          onChange={(e) => setPi(e.target.checked)}
          className="accent-emerald-500"
        />
        Professional indemnity insurance verified
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Professional Standing"}
      </button>
    </form>
  );
}
