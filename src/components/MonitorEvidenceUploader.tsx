"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMonitorEvidence } from "@/actions/fiduciaryActions";
import { Upload, Film, ImageIcon } from "lucide-react";

export function MonitorEvidenceUploader({ drawdownRequestId }: { drawdownRequestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        await uploadMonitorEvidence(formData);
        setFileName("");
        form.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept="image/*,video/*"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold disabled:opacity-60"
        >
          <Upload className="w-3.5 h-3.5" />
          {pending ? "Uploading…" : "Attach Proof"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <ImageIcon className="w-3 h-3" /> <Film className="w-3 h-3" /> Site photo or video evidence
        (image/video)
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <input type="hidden" name="drawdownRequestId" value={drawdownRequestId} />
    </form>
  );
}
