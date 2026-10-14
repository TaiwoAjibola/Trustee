"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIndependenceDeclaration } from "@/actions/fiduciaryActions";
import { FileSignature } from "lucide-react";

export function SignDeclarationButton({
  projectId,
  monitorId,
  signed,
}: {
  projectId: string;
  monitorId: string;
  signed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (signed) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
        <FileSignature className="w-3.5 h-3.5 mr-1" /> Independence & conflict declaration signed
      </span>
    );
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          setError(null);
          try {
            await signIndependenceDeclaration({ projectId, monitorId });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed.");
          }
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-60"
    >
      <FileSignature className="w-3.5 h-3.5" />
      {pending ? "Signing…" : "Sign Independence Declaration"}
    </button>
  );
}
