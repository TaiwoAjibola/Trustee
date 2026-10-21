import { DrawdownStatus } from "@prisma/client";

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  [DrawdownStatus.SUBMITTED]: "Awaiting monitor report",
  [DrawdownStatus.DEFICIENT]: "Corrections required",
  [DrawdownStatus.CERTIFIED_BY_MONITOR]: "Ready for trustee review",
  [DrawdownStatus.APPROVED]: "Approved — awaiting payment",
  [DrawdownStatus.PAID]: "Payment completed",
  [DrawdownStatus.REJECTED]: "Rejected",
};

export const INVESTOR_PAYMENT_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Pending acknowledgement",
  ACKNOWLEDGED: "Acknowledged",
  VERIFIED: "Verified",
};

export const CASH_TXN_LABELS: Record<string, string> = {
  PROJECT_INVESTMENT_SUBSCRIPTION: "Investor payment received",
  ASSET_PURCHASE_COLLECTION: "Asset purchase collection received",
  DRAWDOWN_DISBURSEMENT: "Milestone payment",
  MONITOR_FEE: "Independent monitor fee",
  INVESTOR_DISTRIBUTION: "Investor withdrawal / payout",
  STALL_REMEDY_SALE: "Stall remedy sale",
};

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cheque",
  "Internal Transfer",
  "Cash",
  "Other",
];

export function milestoneStatusLabel(status: string) {
  return MILESTONE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function paymentStatusLabel(status: string) {
  return INVESTOR_PAYMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function cashTxnLabel(type: string) {
  return CASH_TXN_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}
