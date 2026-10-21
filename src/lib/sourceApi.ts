import { GATE_LABELS } from "@/lib/slaEngine";

export type SourceStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WORK_COMPLETED"
  | "COMPLETED"
  | "CANCELLED";

export type SourceMonitor = { id: string; name: string | null; email: string | null };

export type SourceMilestoneRecord = {
  id: string;
  externalId: string;
  gateType: keyof typeof GATE_LABELS;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  sourceStatus: SourceStatus;
  sourceStatusLabel: string;
  progressPct: number;
  dueAt: string | null;
  completedAt: string | null;
  sourceUpdatedAt: string;
};

export type SourceMilestoneReview = {
  drawdownRequestId: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  slaDeadline: string;
  reviewComment: string | null;
  openDeficiency: string | null;
  canReview: boolean;
  paymentReference: string | null;
  paymentDate: string | null;
  reportCount: number;
  documentCount: number;
  monitors: SourceMonitor[];
};

export type SourceMilestone = SourceMilestoneRecord & {
  review: SourceMilestoneReview | null;
};

export type SourceInvestorPayment = {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string | null;
  amount: number;
  currency: string;
  method: string | null;
  reference: string;
  status: string;
  paidAt: string;
  receivedAt: string;
  acknowledgedAt: string | null;
  receiptRef: string | null;
  notificationStatus: string;
};

type SourceEnvelope<T> = {
  source: string;
  fetchedAt: string;
  projectId: string;
  data: T;
};

export class SourceApiError extends Error {
  status: number;
  endpoint: string;
  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "SourceApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  WORK_COMPLETED: "Work completed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function sourceBaseUrl() {
  if (process.env.SOURCE_API_BASE_URL) return process.env.SOURCE_API_BASE_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

async function getJson<T>(path: string): Promise<SourceEnvelope<T>> {
  const endpoint = `${sourceBaseUrl()}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.SOURCE_API_KEY) headers["x-source-api-key"] = process.env.SOURCE_API_KEY;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new SourceApiError(
      error instanceof Error ? error.message : "Source API request failed",
      0,
      endpoint
    );
  }

  if (!response.ok) {
    let detail = `Source API returned HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // response was not JSON; keep the HTTP status message
    }
    throw new SourceApiError(detail, response.status, endpoint);
  }

  return (await response.json()) as SourceEnvelope<T>;
}

export async function getProjectMilestones(projectId: string) {
  return getJson<SourceMilestoneRecord[]>(
    `/api/source/projects/${encodeURIComponent(projectId)}/milestones`
  );
}

export async function getProjectInvestorPayments(projectId: string) {
  return getJson<SourceInvestorPayment[]>(
    `/api/source/projects/${encodeURIComponent(projectId)}/investor-payments`
  );
}
