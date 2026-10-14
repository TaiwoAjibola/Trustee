"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMonitorKycDocument } from "@/actions/fiduciaryActions";
import { DocumentType } from "@prisma/client";
import { Upload } from "lucide-react";

const OPTIONS: { value: DocumentType; label: string }[] = [
  { value: DocumentType.MONITOR_ID, label: "Government ID" },
  { value: DocumentType.PROFESSIONAL_LICENSE, label: "Professional License (COREN/NIQS/ARCON)" },
  { value: DocumentType.PI_INSURANCE, label: "Professional Indemnity Insurance" },
  { value: DocumentType.MONITOR_DECLARATION, label: "Independence Declaration" },
];

export function MonitorKycUploader() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await uploadMonitorKycDocument(formData);
        e.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">Document</label>
        <select
          name="docType"
          defaultValue={DocumentType.MONITOR_ID}
          className="mt-1 block rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="file"
        name="file"
        required
        className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-60"
      >
        <Upload className="w-3.5 h-3.5" />
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}
