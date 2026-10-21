import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { formatNaira } from "@/lib/utils";
import { Building2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role?: Role } | undefined)?.role ?? Role.FIDUCIARY_EXEC;

  const projects = await prisma.project.findMany({
    include: { bankAccounts: true, drawdownRequests: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
        <p className="text-sm text-slate-500">
          All trust-governed projects under First Trustees administration
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          No projects registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const cashInCustody = p.bankAccounts.reduce((s, a) => s + a.balance, 0);
            return (
              <Link
                key={p.id}
                href={`/trustee-dashboard/project/${p.id}`}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-sky-400 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-sky-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{p.code}</p>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">
                    {p.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Budget</p>
                    <p className="font-semibold text-slate-900">{formatNaira(p.totalBudget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">In Custody</p>
                    <p className="font-semibold text-emerald-600">{formatNaira(cashInCustody)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Drawdowns</p>
                    <p className="font-semibold text-slate-900">{p.drawdownRequests.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Funding Close</p>
                    <p className="font-semibold text-slate-900">
                      {p.fundingCloseDate
                        ? new Date(p.fundingCloseDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-sky-600 flex items-center gap-1">
                  Open Ledger <ArrowUpRight className="w-3.5 h-3.5" />
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
