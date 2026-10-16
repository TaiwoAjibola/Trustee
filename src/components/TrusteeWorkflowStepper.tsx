import { DrawdownStatus, Role } from "@prisma/client";
import { GATE_LABELS } from "@/lib/slaEngine";
import { ApprovalActions } from "@/components/ApprovalActions";
import { MonitorInitiator } from "@/components/MonitorInitiator";
import { ConfirmDeveloperButton } from "@/components/ConfirmDeveloperButton";

export function TrusteeWorkflowStepper({
  request,
  monitorAssignment,
  monitorId,
  monitorName,
  role,
}: {
  request: {
    id: string;
    gateType: keyof typeof GATE_LABELS;
    status: DrawdownStatus;
  };
  monitorAssignment: { status: string; monitorId: string } | null;
  monitorId: string | null;
  monitorName?: string;
  role: Role;
}) {
  const status = request.status;
  const initiated = !!monitorAssignment;
  const certified =
    monitorAssignment?.status === "CONFIRMED" ||
    ([DrawdownStatus.CERTIFIED_BY_MONITOR, DrawdownStatus.APPROVED, DrawdownStatus.PAID] as DrawdownStatus[]).includes(
      status
    );

  const steps = [
    { n: 1, label: "Fund Request (Developer)", done: true },
    { n: 2, label: "Trustee Acknowledge", done: status !== DrawdownStatus.SUBMITTED },
    { n: 3, label: "Initiate Monitor", done: initiated },
    { n: 4, label: "Monitor Confirms Phase", done: certified },
    {
      n: 5,
      label: "Trustee Confirms → Developer",
      done: status === DrawdownStatus.APPROVED || status === DrawdownStatus.PAID,
    },
    { n: 6, label: "Pay + Receipts", done: status === DrawdownStatus.PAID },
  ];

  let currentSet = false;
  const rendered = steps.map((s) => {
    const isCurrent = !s.done && !currentSet;
    if (isCurrent) currentSet = true;
    return { ...s, isCurrent };
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">
          Trustee Workflow Loop · {GATE_LABELS[request.gateType]}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          The end-to-end control loop from developer fund request to paid &amp; receipted disbursement.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {rendered.map((s) => (
          <div
            key={s.n}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
              s.done
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                : s.isCurrent
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                : "bg-white border-slate-200 text-slate-500"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                s.done
                  ? "bg-emerald-600 text-white"
                  : s.isCurrent
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {s.n}
            </span>
            {s.label}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
        <ApprovalActions drawdownRequestId={request.id} status={status} role={role} />
        <MonitorInitiator
          drawdownRequestId={request.id}
          monitorId={monitorId}
          initiated={initiated}
          monitorName={monitorName}
        />
        <ConfirmDeveloperButton
          drawdownRequestId={request.id}
          certified={certified}
          alreadyActioned={status === DrawdownStatus.APPROVED || status === DrawdownStatus.PAID}
        />
      </div>
    </div>
  );
}
