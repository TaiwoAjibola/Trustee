"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import {
  retryInvestorAnnouncement,
  sendDeveloperMessage,
  sendInvestorAnnouncement,
} from "@/actions/fiduciaryActions";
import { formatDateTime } from "@/lib/utils";

type Announcement = {
  id: string;
  subject: string;
  message: string;
  recipientScope: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: string;
  sentByName: string;
  sentAt: Date | string;
  lastAttemptAt: Date | string | null;
};

type Message = {
  id: string;
  senderName: string;
  senderRole: string;
  body: string;
  drawdownRequestId: string | null;
  createdAt: Date | string;
};

type MilestoneOption = { id: string; name: string };

const SCOPE_LABEL: Record<string, string> = {
  ALL: "All investors",
  FUNDED: "Funded investors",
  OUTSTANDING: "Investors with outstanding balance",
};

const DELIVERY_STYLE: Record<string, string> = {
  SENT: "bg-emerald-500/10 text-emerald-700",
  PARTIAL: "bg-amber-500/10 text-amber-700",
  FAILED: "bg-rose-500/10 text-rose-700",
  QUEUED: "bg-slate-500/10 text-slate-600",
};

export function CommunicationsCentre({
  projectId,
  announcements,
  messages,
  milestones,
  investorCount,
}: {
  projectId: string;
  announcements: Announcement[];
  messages: Message[];
  milestones: MilestoneOption[];
  investorCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [scope, setScope] = useState("ALL");
  const [messageBody, setMessageBody] = useState("");
  const [developerBody, setDeveloperBody] = useState("");
  const [milestoneId, setMilestoneId] = useState("");

  function submitAnnouncement(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await sendInvestorAnnouncement({
          projectId,
          subject,
          message: messageBody,
          recipientScope: scope as "ALL" | "FUNDED" | "OUTSTANDING",
        });
        setSubject("");
        setMessageBody("");
        setScope("ALL");
        setNotice("Investor announcement sent. Delivery history has been updated.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Announcement failed.");
      }
    });
  }

  function retry(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await retryInvestorAnnouncement(id);
        setNotice("Delivery retried without creating a duplicate announcement.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Retry failed.");
      }
    });
  }

  function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await sendDeveloperMessage({
          projectId,
          body: developerBody,
          drawdownRequestId: milestoneId || null,
        });
        setDeveloperBody("");
        setMilestoneId("");
        setNotice("Message sent to the developer conversation.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Message failed.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600" /> Investor notifications
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Send project updates to {investorCount} investor{investorCount === 1 ? "" : "s"} and
            track delivery. Failed deliveries are retained for a safe retry.
          </p>
        </div>

        <form onSubmit={submitAnnouncement} className="px-5 py-4 space-y-3 border-b border-slate-200 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              <span className="block uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                Subject
              </span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Monthly project update"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
                required
              />
            </label>
            <label className="text-xs text-slate-600">
              <span className="block uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                Recipients
              </span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
              >
                {Object.entries(SCOPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            <span className="block uppercase tracking-wider text-[10px] text-slate-400 mb-1">
              Message
            </span>
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={3}
              placeholder="Share progress, funding or payment information with investors."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send announcement
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 px-4">Announcement</th>
                <th className="py-2 pr-4">Audience</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Sent</th>
                <th className="py-2 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {announcements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-slate-500">
                    No investor announcements sent yet.
                  </td>
                </tr>
              )}
              {announcements.map((announcement) => (
                <tr key={announcement.id} className="align-top">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{announcement.subject}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                      {announcement.message}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {SCOPE_LABEL[announcement.recipientScope] ?? announcement.recipientScope}
                    <span className="block text-[10px] text-slate-400">
                      {announcement.recipientCount} recipient
                      {announcement.recipientCount === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        DELIVERY_STYLE[announcement.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {announcement.status}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1">
                      {announcement.deliveredCount} delivered
                      {announcement.failedCount > 0
                        ? ` · ${announcement.failedCount} failed`
                        : ""}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {formatDateTime(announcement.sentAt)}
                    <span className="block text-[10px] text-slate-400">
                      by {announcement.sentByName}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {announcement.status !== "SENT" ? (
                      <button
                        onClick={() => retry(announcement.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry delivery
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        Delivered
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-600" /> Developer conversation
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Messages are retained in order with sender, timestamp and milestone reference.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto bg-slate-50/40">
          {messages.length === 0 && (
            <p className="text-xs text-slate-500">No messages in this conversation yet.</p>
          )}
          {messages.map((message) => {
            const fromTrustee = message.senderRole === "TRUSTEE";
            return (
              <div
                key={message.id}
                className={`flex ${fromTrustee ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl border px-3 py-2 ${
                    fromTrustee
                      ? "bg-sky-50 border-sky-100"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-800">
                    {message.senderName}
                    <span className="ml-2 font-normal uppercase tracking-wider text-[9px] text-slate-400">
                      {message.senderRole}
                    </span>
                  </p>
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatDateTime(message.createdAt)}
                    {message.drawdownRequestId
                      ? ` · Milestone ${message.drawdownRequestId}`
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={submitMessage} className="px-5 py-4 border-t border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <textarea
              value={developerBody}
              onChange={(event) => setDeveloperBody(event.target.value)}
              rows={2}
              placeholder="Write a message to the developer…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
              required
            />
            <div className="space-y-2">
              <select
                value={milestoneId}
                onChange={(event) => setMilestoneId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500"
              >
                <option value="">No milestone reference</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send message
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
