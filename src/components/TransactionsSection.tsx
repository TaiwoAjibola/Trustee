import Link from "next/link";
import { CashTxnDirection } from "@prisma/client";
import { cashTxnLabel } from "@/lib/labels";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { ChevronDown, ReceiptText } from "lucide-react";

type Transaction = {
  id: string;
  bankAccountId: string | null;
  type: string;
  direction: string;
  amount: number;
  currency: string;
  referenceId: string | null;
  counterparty: string | null;
  method: string | null;
  status: string | null;
  receiptRef: string | null;
  note: string | null;
  recordedById: string;
  recordedAt: Date | string;
};

type MilestoneRef = {
  id: string;
  projectId: string;
  gateType: string;
  projectName: string;
};

export function TransactionsSection({
  transactions,
  milestones,
  accountLabelById,
  actorNameById,
}: {
  transactions: Transaction[];
  milestones: MilestoneRef[];
  accountLabelById: Record<string, string>;
  actorNameById: Record<string, string>;
}) {
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const totalIn = transactions
    .filter((t) => t.direction === CashTxnDirection.IN)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.direction === CashTxnDirection.OUT)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2">
          Money in: <strong className="font-mono">{formatNaira(totalIn)}</strong>
        </span>
        <span className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2">
          Money out: <strong className="font-mono">{formatNaira(totalOut)}</strong>
        </span>
        <span className="rounded-lg bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2">
          Net movement: <strong className="font-mono">{formatNaira(totalIn - totalOut)}</strong>
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.1fr_1.3fr_1.5fr_1fr_1.2fr_1fr_1fr] gap-3 px-4 py-2 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <span>Date</span>
          <span>Investor / recipient</span>
          <span>Project / milestone</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Reference</span>
          <span>Recorded by</span>
        </div>
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No transactions recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {transactions.map((txn) => {
              const related = txn.referenceId ? milestoneById.get(txn.referenceId) : undefined;
              const isIn = txn.direction === CashTxnDirection.IN;
              return (
                <details key={txn.id} className="group">
                  <summary className="list-none cursor-pointer px-4 py-3 grid grid-cols-2 lg:grid-cols-[1.1fr_1.3fr_1.5fr_1fr_1.2fr_1fr_1fr] gap-3 items-center text-xs hover:bg-slate-50">
                    <span className="text-slate-500">{formatDateTime(txn.recordedAt)}</span>
                    <span className="text-slate-800 font-medium">
                      {txn.counterparty ?? "—"}
                    </span>
                    <span className="text-slate-600">
                      {related ? (
                        <>
                          {related.projectName}
                          <span className="block text-[10px] text-slate-400">
                            {related.gateType.replace(/_/g, " ")}
                          </span>
                        </>
                      ) : (
                        "Project account"
                      )}
                    </span>
                    <span className="text-slate-600">{cashTxnLabel(txn.type)}</span>
                    <span
                      className={`font-mono font-semibold ${
                        isIn ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {formatNaira(txn.amount)}
                    </span>
                    <span className="font-mono text-slate-600">
                      {txn.receiptRef ?? txn.referenceId ?? "—"}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-slate-500">
                      {actorNameById[txn.recordedById] ?? txn.recordedById}
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition" />
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 bg-slate-50/70 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Status</p>
                        <p className="text-slate-700">{txn.status ?? "Completed"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Method</p>
                        <p className="text-slate-700">{txn.method ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Account</p>
                        <p className="text-slate-700">
                          {txn.bankAccountId
                            ? accountLabelById[txn.bankAccountId] ?? txn.bankAccountId
                            : "—"}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Note</p>
                        <p className="text-slate-600">{txn.note ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Supporting record
                        </p>
                        {related ? (
                          <Link
                            href={`/trustee-dashboard/project/${related.projectId}/milestone/${related.id}`}
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-semibold"
                          >
                            <ReceiptText className="w-3.5 h-3.5" /> View milestone review
                          </Link>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
