"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { acknowledgeInvestorPayment } from "@/actions/fiduciaryActions";

export function InvestorPaymentAck({
  investorId,
  paymentStatus,
  paymentId,
  label = "Acknowledge payment",
}: {
  investorId: string;
  paymentStatus: string;
  paymentId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const acknowledged = paymentStatus === "ACKNOWLEDGED";

  return (
    <div className="flex items-center gap-2">
      {acknowledged ? (
        <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="w-4 h-4 mr-1" /> Acknowledged
        </span>
      ) : (
        <button
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await acknowledgeInvestorPayment(investorId, paymentId);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Action failed.");
              }
            });
          }}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {label}
        </button>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
