import { GateType } from "@prisma/client";

/**
 * Calculates a deadline excluding weekends (Saturday and Sunday).
 */
export function calculateSlaDeadline(startDate: Date, businessDays = 4): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

export type SlaStatus = {
  code: "GREEN" | "YELLOW" | "RED";
  hoursRemaining: number;
  label: string;
};

export function getSlaStatus(deadline: Date): SlaStatus {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return {
      code: "RED",
      hoursRemaining,
      label: `SLA Breached (${Math.abs(hoursRemaining)}h ago)`,
    };
  }
  if (hoursRemaining <= 48) {
    return { code: "YELLOW", hoursRemaining, label: `${hoursRemaining}h remaining` };
  }
  return { code: "GREEN", hoursRemaining, label: `${hoursRemaining}h remaining` };
}

/**
 * Gate G10 Investor Exit Waterfall Calculation:
 * Calculates 24% p.a. accrued return from funding close date.
 */
export function calculateInvestorExit(
  principalAmount: number,
  fundingCloseDate: Date,
  targetDate: Date = new Date()
) {
  const diffTime = Math.abs(targetDate.getTime() - fundingCloseDate.getTime());
  const elapsedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const annualRate = 0.24;
  const accruedReturn = principalAmount * annualRate * (elapsedDays / 365);
  const totalPayout = principalAmount + accruedReturn;

  return {
    principalAmount,
    fundingCloseDate,
    targetDate,
    elapsedDays,
    annualRate: "24.0%",
    accruedReturn: Number(accruedReturn.toFixed(2)),
    totalPayout: Number(totalPayout.toFixed(2)),
  };
}

export const GATE_LABELS: Record<GateType, string> = {
  G0_FUNDING_CLOSE: "G0 · Funding Close",
  G1_PRELIM_PROCUREMENT_01: "G1 · Preliminary Procurement",
  G2_SUBSTRUCTURE: "G2 · Substructure",
  G3_SUPERSTRUCTURE: "G3 · Superstructure",
  G4_ROOF: "G4 · Roof",
  G5_PROCUREMENT_02: "G5 · Procurement 02",
  G6_MEP_FINISHES: "G6 · MEP & Finishes",
  G7_PROCUREMENT_03: "G7 · Procurement 03",
  G8_MEP_FURNITURE: "G8 · MEP & Furniture",
  G9_PRACTICAL_COMPLETION: "G9 · Practical Completion",
  G10_INVESTOR_EXIT: "G10 · Investor Exit",
  G11_CLOSEOUT: "G11 · Closeout",
};
