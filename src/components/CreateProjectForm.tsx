"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/actions/fiduciaryActions";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState(0);
  const [target, setTarget] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createProject({
          name,
          code,
          totalBudget: budget,
          targetCompletion: new Date(target),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Project creation failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">Project Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="SYND-XXXX-001"
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Budget (₦)</label>
          <input
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">
            Target Completion
          </label>
          <input
            type="date"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create Project (Gate G0 Pending)"}
      </button>
    </form>
  );
}
