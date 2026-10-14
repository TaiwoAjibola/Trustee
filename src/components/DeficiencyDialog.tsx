"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueDeficiencyNotice } from "@/actions/fiduciaryActions";

export function DeficiencyDialog({ drawdownRequestId }: { drawdownRequestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await issueDeficiencyNotice({
          drawdownRequestId,
          consolidatedMessage: message,
        });
        setOpen(false);
        setMessage("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to issue notice.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
      >
        Issue Deficiency
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900">
              Consolidated Deficiency Notice
            </h3>
            <p className="text-xs text-slate-500">
              Per fiduciary rule, only ONE consolidated notice may be issued per drawdown
              request.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              placeholder="Describe all deficiencies in a single consolidated statement…"
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500"
            />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="text-xs px-3 py-2 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-400 disabled:opacity-60"
              >
                {pending ? "Issuing…" : "Issue Notice"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
