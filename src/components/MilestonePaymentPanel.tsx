"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { processMilestonePayment } from "@/actions/fiduciaryActions";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatNaira } from "@/lib/utils";

export function MilestonePaymentPanel({
  drawdownRequestId,
  approvedAmount,
  defaultRecipient,
}: {
  drawdownRequestId: string;
  approvedAmount: number;
  defaultRecipient: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [amount, setAmount] = useState(approvedAmount);
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState(
    `FT-${drawdownRequestId.slice(-8).toUpperCase()}`
  );
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await processMilestonePayment({
          drawdownRequestId,
          amount,
          recipient,
          method,
          reference,
          paymentDate: new Date(`${paymentDate}T12:00:00`),
          notes,
        });
        setDone(true);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed.");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
        <CheckCircle2 className="w-4 h-4 mr-1" /> Payment recorded
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
        >
          <Wallet className="w-3.5 h-3.5" /> Record milestone payment
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">Record payment</p>
            <p className="text-[11px] text-slate-500">
              Approved allocation: {formatNaira(approvedAmount)}. This is recorded separately from
              approval and is written to the audit trail.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] text-slate-500">
              Amount (₦)
              <input
                type="number"
                min={0}
                max={approvedAmount}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-[11px] text-slate-500">
              Payment date
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-[11px] text-slate-500 sm:col-span-2">
              Recipient
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-[11px] text-slate-500">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-500">
              Reference / receipt
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-[11px] text-slate-500 sm:col-span-2">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-50"
            >
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Record payment
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
