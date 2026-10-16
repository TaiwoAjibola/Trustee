const RECIPIENT_STYLES: Record<string, string> = {
  DEVELOPER: "bg-sky-500/10 text-sky-700",
  INVESTOR: "bg-emerald-500/10 text-emerald-700",
  MONITOR: "bg-violet-500/10 text-violet-700",
  TRUSTEE: "bg-slate-500/10 text-slate-600",
};

const RECIPIENT_LABEL: Record<string, string> = {
  DEVELOPER: "To Developer",
  INVESTOR: "To Investor",
  MONITOR: "To Monitor",
  TRUSTEE: "Internal",
};

export function CommunicationsPanel({
  notifications,
}: {
  notifications: {
    id: string;
    recipientType: string;
    title: string;
    body: string;
    relatedDrawdownId: string | null;
    createdAt: Date | string;
  }[];
}) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No communications issued yet for this project.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {notifications.map((n) => (
        <li
          key={n.id}
          className="border border-slate-200 rounded-lg p-4 flex items-start gap-3"
        >
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
              RECIPIENT_STYLES[n.recipientType] ?? ""
            }`}
          >
            {RECIPIENT_LABEL[n.recipientType] ?? n.recipientType}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{n.title}</p>
            <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {new Date(n.createdAt).toLocaleString()} · Ref{" "}
              {n.relatedDrawdownId ? n.relatedDrawdownId.slice(0, 8) : "—"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
