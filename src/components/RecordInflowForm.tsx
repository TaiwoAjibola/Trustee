"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordInflow } from "@/actions/fiduciaryActions";
import { CashTxnType } from "@prisma/client";

export function RecordInflowForm({
  projectId,
  accounts,
}: {
  projectId: string;
  accounts: { id: string; type: string; accountNumber: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<CashTxnType>(CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION);
  const [amount, setAmount] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await recordInflow({ projectId, bankAccountId, type, amount });
        setAmount(0);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Recording failed.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Account</label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.type} ({a.accountNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider">Payment type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CashTxnType)}
            className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
          >
            <option value={CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION}>
              Investor subscription
            </option>
            <option value={CashTxnType.ASSET_PURCHASE_COLLECTION}>
              Asset purchase collection
            </option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider">Amount (₦)</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || amount <= 0}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record payment received"}
      </button>
    </form>
  );
}
