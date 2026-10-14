"use server";

import { prisma } from "@/lib/prisma";
import { calculateSlaDeadline } from "@/lib/slaEngine";
import {
  DrawdownStatus,
  GateType,
  ProjectStatus,
  AccountType,
  DocumentType,
  Role,
  CashTxnType,
  CashTxnDirection,
  KycStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateInvestorExit } from "@/lib/slaEngine";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

async function currentActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized: No active session.");
  return {
    id: (session.user as unknown as { id: string }).id,
    name: session.user.name ?? "System",
    role: (session.user as unknown as { role: Role }).role,
  };
}

export async function submitDrawdownRequest(data: {
  projectId: string;
  gateType: GateType;
  requestedAmount: number;
}) {
  const actor = await currentActor();
  const cp = await prisma.conditionPrecedent.findUnique({
    where: { projectId: data.projectId },
  });

  if (!cp || !cp.clearedForActivation) {
    throw new Error(
      "Cannot issue drawdown request: Conditions Precedent (Gate G0) not fully cleared."
    );
  }

  const slaDeadline = calculateSlaDeadline(new Date(), 4);

  const request = await prisma.drawdownRequest.create({
    data: {
      projectId: data.projectId,
      requestedById: actor.id,
      gateType: data.gateType,
      requestedAmount: data.requestedAmount,
      slaDeadline,
      status: DrawdownStatus.SUBMITTED,
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DRAWDOWN_SUBMITTED",
      details: `Trustee-initiated drawdown for Gate ${data.gateType} requesting ₦${data.requestedAmount.toLocaleString()}`,
    },
  });

  revalidatePath("/ops-dashboard");
  return request;
}

/**
 * Enforces Single Consolidated Deficiency Notice Rule.
 */
export async function issueDeficiencyNotice(data: {
  drawdownRequestId: string;
  consolidatedMessage: string;
}) {
  const actor = await currentActor();
  const existingNotice = await prisma.deficiencyNotice.findFirst({
    where: { drawdownRequestId: data.drawdownRequestId, isResolved: false },
  });

  if (existingNotice) {
    throw new Error(
      "FIDUCIARY RULE VIOLATION: A deficiency notice has already been issued for this drawdown request. Serial deficiency queries are strictly prohibited."
    );
  }

  const notice = await prisma.deficiencyNotice.create({
    data: {
      drawdownRequestId: data.drawdownRequestId,
      issuedById: actor.id,
      consolidatedMessage: data.consolidatedMessage,
    },
  });

  const request = await prisma.drawdownRequest.update({
    where: { id: data.drawdownRequestId },
    data: { status: DrawdownStatus.DEFICIENT },
  });

  await prisma.auditLog.create({
    data: {
      projectId: request.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DEFICIENCY_NOTICE_ISSUED",
      details: `Consolidated Deficiency Notice issued: ${data.consolidatedMessage}`,
    },
  });

  revalidatePath("/ops-dashboard");
  return notice;
}

export async function certifyMonitorProgress(data: {
  drawdownRequestId: string;
  physicalProgressVerified: boolean;
  varianceFlagged: boolean;
  notes: string;
  estimateAtCompletion: number;
}) {
  const actor = await currentActor();
  const certificate = await prisma.monitorCertificate.create({
    data: {
      drawdownRequestId: data.drawdownRequestId,
      monitorId: actor.id,
      physicalProgressVerified: data.physicalProgressVerified,
      varianceFlagged: data.varianceFlagged,
      notes: data.notes,
    },
  });

  const request = await prisma.drawdownRequest.update({
    where: { id: data.drawdownRequestId },
    data: {
      status: DrawdownStatus.CERTIFIED_BY_MONITOR,
      estimateAtCompletion: data.estimateAtCompletion,
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: request.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "PHYSICAL_MILESTONE_CERTIFIED",
      details: `Physical progress verified: ${data.physicalProgressVerified}. EAC set to ₦${data.estimateAtCompletion.toLocaleString()}`,
    },
  });

  revalidatePath("/monitor-portal");
  revalidatePath("/ops-dashboard");
  return certificate;
}

/* ---------------------------------------------------------------------------
 * MODULE 1 — Project Activation & Conditions Precedent (Gate G0)
 * ------------------------------------------------------------------------- */

export async function createProject(data: {
  name: string;
  code: string;
  totalBudget: number;
  targetCompletion: Date;
}) {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      code: data.code,
      totalBudget: data.totalBudget,
      targetCompletion: data.targetCompletion,
      status: ProjectStatus.PENDING_CP,
    },
  });

  await prisma.conditionPrecedent.create({
    data: { projectId: project.id },
  });

  revalidatePath("/ops-dashboard");
  return project;
}

export async function updateConditionPrecedent(data: {
  projectId: string;
  masterScheduleExecuted: boolean;
  landRegistryLienRegistered: boolean;
  boqApproved: boolean;
  minimumFundingMet: boolean;
  insuranceVerified: boolean;
}) {
  const actor = await currentActor();
  const allCleared =
    data.masterScheduleExecuted &&
    data.landRegistryLienRegistered &&
    data.boqApproved &&
    data.minimumFundingMet &&
    data.insuranceVerified;

  const cp = await prisma.conditionPrecedent.update({
    where: { projectId: data.projectId },
    data: {
      masterScheduleExecuted: data.masterScheduleExecuted,
      landRegistryLienRegistered: data.landRegistryLienRegistered,
      boqApproved: data.boqApproved,
      minimumFundingMet: data.minimumFundingMet,
      insuranceVerified: data.insuranceVerified,
      clearedForActivation: allCleared,
      activatedAt: allCleared ? new Date() : null,
    },
  });

  if (allCleared) {
    await prisma.project.update({
      where: { id: data.projectId },
      data: { status: ProjectStatus.ACTIVE, fundingCloseDate: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "CP_UPDATED",
      details: allCleared
        ? "All Conditions Precedent cleared — project activated and Funding Close Date locked."
        : "Conditions Precedent updated (not yet fully cleared).",
    },
  });

  revalidatePath("/ops-dashboard");
  revalidatePath(`/ops-dashboard/project/${data.projectId}`);
  return cp;
}

/* ---------------------------------------------------------------------------
 * MODULE 3 — Multi-step fiduciary approval workflow (Gates G1–G11)
 * ------------------------------------------------------------------------- */

export async function acknowledgeDrawdown(drawdownRequestId: string) {
  const actor = await currentActor();
  const request = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: { status: DrawdownStatus.ACKNOWLEDGED },
  });
  await prisma.auditLog.create({
    data: {
      projectId: request.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DRAWDOWN_ACKNOWLEDGED",
      details: "Ops Analyst acknowledged KYC & invoice verification.",
    },
  });
  revalidatePath("/ops-dashboard");
}

export async function recommendDrawdown(drawdownRequestId: string) {
  const actor = await currentActor();
  const request = await prisma.drawdownRequest.findUnique({
    where: { id: drawdownRequestId },
    include: { monitorCertificates: true },
  });
  if (!request) throw new Error("Drawdown request not found.");
  if (request.monitorCertificates.length === 0) {
    throw new Error(
      "CONTROL GATE: Independent Monitor technical certification is mandatory before any drawdown can be recommended for disbursement."
    );
  }
  const updated = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: { status: DrawdownStatus.APPROVED },
  });
  await prisma.auditLog.create({
    data: {
      projectId: updated.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DRAWDOWN_RECOMMENDED",
      details: "Ops Lead verified Independent Monitor certificate and recommended disbursement.",
    },
  });
  revalidatePath("/ops-dashboard");
}

export async function approveAndPayDrawdown(drawdownRequestId: string) {
  const actor = await currentActor();
  const request = await prisma.drawdownRequest.findUnique({
    where: { id: drawdownRequestId },
    include: { monitorCertificates: true },
  });
  if (!request) throw new Error("Drawdown request not found.");
  if (request.monitorCertificates.length === 0) {
    throw new Error(
      "CONTROL GATE: Independent Monitor technical certification is mandatory before any drawdown can be paid."
    );
  }
  const updated = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: { status: DrawdownStatus.PAID },
  });

  const executionAcct = await prisma.bankAccount.findFirst({
    where: { projectId: updated.projectId, type: AccountType.PROJECT_EXECUTION_ACCT },
  });
  const sourceAcct = await prisma.bankAccount.findFirst({
    where: { projectId: updated.projectId, type: AccountType.PROJECT_INVESTMENT_ACCT },
  });

  // Internal fiduciary transfer: release from Investment custody into the Execution account.
  if (sourceAcct) {
    await prisma.bankAccount.update({
      where: { id: sourceAcct.id },
      data: { balance: { decrement: updated.requestedAmount } },
    });
    await prisma.cashTransaction.create({
      data: {
        projectId: updated.projectId,
        bankAccountId: sourceAcct.id,
        type: CashTxnType.DRAWDOWN_DISBURSEMENT,
        direction: CashTxnDirection.OUT,
        amount: updated.requestedAmount,
        referenceId: updated.id,
        note: `Drawdown released from Investment custody for ${updated.gateType}.`,
        recordedById: actor.id,
      },
    });
  }
  if (executionAcct) {
    await prisma.bankAccount.update({
      where: { id: executionAcct.id },
      data: { balance: { increment: updated.requestedAmount } },
    });
    await prisma.cashTransaction.create({
      data: {
        projectId: updated.projectId,
        bankAccountId: executionAcct.id,
        type: CashTxnType.DRAWDOWN_DISBURSEMENT,
        direction: CashTxnDirection.IN,
        amount: updated.requestedAmount,
        referenceId: updated.id,
        note: `Drawdown received into Execution account for ${updated.gateType}.`,
        recordedById: actor.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: updated.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DRAWDOWN_PAID",
      details: `Fiduciary Exec approved final payment of ₦${updated.requestedAmount.toLocaleString()}.`,
    },
  });
  revalidatePath("/ops-dashboard");
  revalidatePath(`/ops-dashboard/project/${updated.projectId}`);
}

export async function resolveDeficiency(drawdownRequestId: string) {
  const actor = await currentActor();
  const notice = await prisma.deficiencyNotice.updateMany({
    where: { drawdownRequestId, isResolved: false },
    data: { isResolved: true },
  });
  const request = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: {
      status: DrawdownStatus.SUBMITTED,
      slaDeadline: calculateSlaDeadline(new Date(), 4),
    },
  });
  await prisma.auditLog.create({
    data: {
      projectId: request.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "DEFICIENCY_RESOLVED",
      details: `${notice.count} deficiency notice(s) resolved — drawdown returned to SUBMITTED for re-evaluation.`,
    },
  });
  revalidatePath("/ops-dashboard");
}

/* ---------------------------------------------------------------------------
 * Document Vault
 * ------------------------------------------------------------------------- */

export async function uploadDocument(data: {
  drawdownRequestId?: string;
  referenceId: string;
  documentType: DocumentType;
  s3Url: string;
  fileName: string;
}) {
  const doc = await prisma.documentVault.create({
    data: {
      drawdownRequestId: data.drawdownRequestId,
      referenceId: data.referenceId,
      documentType: data.documentType,
      s3Url: data.s3Url,
      fileName: data.fileName,
    },
  });
  revalidatePath("/ops-dashboard");
  return doc;
}

/* ---------------------------------------------------------------------------
 * Independent Monitor — credentials, evidence proof, per-project declaration
 * ------------------------------------------------------------------------- */

export async function uploadMonitorEvidence(formData: FormData) {
  const actor = await currentActor();
  if (actor.role !== Role.INDEPENDENT_MONITOR) {
    throw new Error("Only the Independent Monitor may upload milestone evidence.");
  }
  const file = formData.get("file");
  const drawdownRequestId = formData.get("drawdownRequestId") as string | null;

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No evidence file provided.");
  }

  const mime = file.type;
  const isVideo = mime.startsWith("video/");
  const isImage = mime.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error("Evidence must be an image or video file.");
  }

  const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "png")).toLowerCase();
  const safeName = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), buffer);

  const doc = await prisma.documentVault.create({
    data: {
      drawdownRequestId: drawdownRequestId || undefined,
      referenceId: drawdownRequestId || actor.id,
      documentType: isVideo ? DocumentType.SITE_VIDEO : DocumentType.SITE_PHOTO,
      s3Url: `/uploads/${safeName}`,
      fileName: file.name,
    },
  });

  if (drawdownRequestId) {
    const req = await prisma.drawdownRequest.findUnique({
      where: { id: drawdownRequestId },
      select: { projectId: true },
    });
    if (req) {
      await prisma.auditLog.create({
        data: {
          projectId: req.projectId,
          actorId: actor.id,
          actorName: actor.name,
          action: "MILESTONE_EVIDENCE_UPLOADED",
          details: `Monitor uploaded ${isVideo ? "video" : "photo"} evidence: ${file.name}`,
        },
      });
    }
  }

  revalidatePath("/monitor-portal");
  if (drawdownRequestId) revalidatePath(`/ops-dashboard/project/${drawdownRequestId}`);
  return doc;
}

export async function upsertMonitorCredential(data: {
  professionalBody: string;
  registrationNumber: string;
  experienceSummary?: string;
  piInsuranceVerified: boolean;
  piInsuranceDocUrl?: string;
}) {
  const actor = await currentActor();
  if (actor.role !== Role.INDEPENDENT_MONITOR) {
    throw new Error("Only an Independent Monitor can maintain professional credentials.");
  }

  const cred = await prisma.monitorCredential.upsert({
    where: { userId: actor.id },
    update: {
      professionalBody: data.professionalBody,
      registrationNumber: data.registrationNumber,
      experienceSummary: data.experienceSummary,
      piInsuranceVerified: data.piInsuranceVerified,
      piInsuranceDocUrl: data.piInsuranceDocUrl,
    },
    create: {
      userId: actor.id,
      professionalBody: data.professionalBody,
      registrationNumber: data.registrationNumber,
      experienceSummary: data.experienceSummary,
      piInsuranceVerified: data.piInsuranceVerified,
      piInsuranceDocUrl: data.piInsuranceDocUrl,
    },
  });

  revalidatePath("/monitor-portal");
  return cred;
}

export async function uploadMonitorKycDocument(formData: FormData) {
  const actor = await currentActor();
  if (actor.role !== Role.INDEPENDENT_MONITOR) {
    throw new Error("Only the Independent Monitor may upload KYC documents.");
  }
  const file = formData.get("file");
  const docType = (formData.get("docType") as string) as DocumentType;

  const allowed: DocumentType[] = [
    DocumentType.MONITOR_ID,
    DocumentType.PROFESSIONAL_LICENSE,
    DocumentType.PI_INSURANCE,
    DocumentType.MONITOR_DECLARATION,
  ];
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No document provided.");
  }
  if (!allowed.includes(docType)) {
    throw new Error("Unsupported KYC document type.");
  }

  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const safeName = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), buffer);

  const doc = await prisma.documentVault.create({
    data: {
      referenceId: actor.id,
      documentType: docType,
      s3Url: `/uploads/${safeName}`,
      fileName: file.name,
    },
  });

  // Uploading KYC evidence moves the standing to Under Review automatically.
  await prisma.monitorCredential.updateMany({
    where: { userId: actor.id, kycStatus: { in: ["PENDING", "REJECTED"] } },
    data: { kycStatus: KycStatus.UNDER_REVIEW },
  });

  revalidatePath("/monitor-portal/profile");
  return doc;
}

export async function reviewMonitorKyc(data: {
  monitorId: string;
  status: KycStatus;
  note?: string;
}) {
  const actor = await currentActor();
  if (actor.role === Role.INDEPENDENT_MONITOR) {
    throw new Error("A monitor cannot review their own KYC.");
  }
  const cred = await prisma.monitorCredential.update({
    where: { userId: data.monitorId },
    data: { kycStatus: data.status, kycNote: data.note },
  });
  revalidatePath("/ops-dashboard/monitors");
  revalidatePath("/monitor-portal/profile");
  return cred;
}

/* ---------------------------------------------------------------------------
 * First Trustees — Monitor appointment, lien lifecycle, inflows, distributions
 * ------------------------------------------------------------------------- */

export async function appointMonitor(data: {
  projectId: string;
  monitorId: string;
  eligibilityCriteriaMet: boolean;
}) {
  const actor = await currentActor();
  const appointment = await prisma.projectMonitor.upsert({
    where: { projectId_monitorId: { projectId: data.projectId, monitorId: data.monitorId } },
    update: { eligibilityCriteriaMet: data.eligibilityCriteriaMet, appointedById: actor.id },
    create: {
      projectId: data.projectId,
      monitorId: data.monitorId,
      appointedById: actor.id,
      eligibilityCriteriaMet: data.eligibilityCriteriaMet,
    },
  });

  if (data.eligibilityCriteriaMet) {
    await prisma.cashTransaction.create({
      data: {
        projectId: data.projectId,
        type: CashTxnType.MONITOR_FEE,
        direction: CashTxnDirection.OUT,
        amount: 0,
        note: "Independent Monitor fee borne by First Trustees (accrual tracked).",
        recordedById: actor.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MONITOR_APPOINTED",
      details: `Independent Monitor ${data.monitorId} appointed. Eligibility criteria met: ${data.eligibilityCriteriaMet}.`,
    },
  });

  revalidatePath(`/ops-dashboard/project/${data.projectId}`);
  return appointment;
}

export async function signIndependenceDeclaration(data: {
  projectId: string;
  monitorId: string;
  declarationDocUrl?: string;
}) {
  const actor = await currentActor();
  if (actor.role !== Role.INDEPENDENT_MONITOR) {
    throw new Error("Only the appointed Independent Monitor can sign the declaration.");
  }
  const declaration = await prisma.projectMonitor.update({
    where: { projectId_monitorId: { projectId: data.projectId, monitorId: data.monitorId } },
    data: {
      independenceDeclarationSigned: true,
      declarationDocUrl: data.declarationDocUrl,
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "INDEPENDENCE_DECLARATION_SIGNED",
      details: "Signed independence & conflict declaration recorded for this project.",
    },
  });

  revalidatePath("/monitor-portal");
  revalidatePath(`/ops-dashboard/project/${data.projectId}`);
  return declaration;
}

export async function vacateLien(projectId: string) {
  const actor = await currentActor();
  const cp = await prisma.conditionPrecedent.update({
    where: { projectId },
    data: { lienVacated: true, lienVacatedAt: new Date() },
  });
  await prisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.COMPLETED } });

  await prisma.auditLog.create({
    data: {
      projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "LIEN_VACATED",
      details: "Registered land-registry lien vacated upon investor exit / final sale.",
    },
  });

  revalidatePath(`/ops-dashboard/project/${projectId}`);
  return cp;
}

export async function recordInflow(data: {
  projectId: string;
  bankAccountId: string;
  type: CashTxnType;
  amount: number;
  note?: string;
}) {
  const actor = await currentActor();
  if (data.amount <= 0) throw new Error("Amount must be positive.");

  const txn = await prisma.cashTransaction.create({
    data: {
      projectId: data.projectId,
      bankAccountId: data.bankAccountId,
      type: data.type,
      direction: CashTxnDirection.IN,
      amount: data.amount,
      note: data.note,
      recordedById: actor.id,
    },
  });

  await prisma.bankAccount.update({
    where: { id: data.bankAccountId },
    data: { balance: { increment: data.amount } },
  });

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "CASH_INFLOW_RECORDED",
      details: `${data.type} of ₦${data.amount.toLocaleString()} received and safeguarded in trust account.`,
    },
  });

  revalidatePath(`/ops-dashboard/project/${data.projectId}`);
  return txn;
}

export async function executeInvestorDistribution(projectId: string) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only the Fiduciary Exec may execute investor distributions.");
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { bankAccounts: true, conditionPrecedent: true },
  });
  if (!project?.fundingCloseDate) throw new Error("Funding Close Date not declared.");
  if (!project.conditionPrecedent?.lienVacated) {
    throw new Error("Control gate: lien must be vacated (investor exit) before distribution.");
  }

  const investmentAcct = project.bankAccounts.find(
    (a) => a.type === AccountType.PROJECT_INVESTMENT_ACCT
  );
  if (!investmentAcct) throw new Error("Project Investment Account not found.");

  const exit = calculateInvestorExit(investmentAcct.balance, project.fundingCloseDate);
  const payout = exit.totalPayout;

  const txn = await prisma.cashTransaction.create({
    data: {
      projectId,
      bankAccountId: investmentAcct.id,
      type: CashTxnType.INVESTOR_DISTRIBUTION,
      direction: CashTxnDirection.OUT,
      amount: payout,
      note: `24% p.a. waterfall distribution — principal ₦${exit.principalAmount.toLocaleString()}, accrued ₦${exit.accruedReturn.toLocaleString()} (${exit.elapsedDays} days).`,
      recordedById: actor.id,
    },
  });

  await prisma.bankAccount.update({
    where: { id: investmentAcct.id },
    data: { balance: { decrement: payout } },
  });

  await prisma.auditLog.create({
    data: {
      projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "INVESTOR_DISTRIBUTION_PAID",
      details: `Investor capital distribution executed: ₦${payout.toLocaleString()}.`,
    },
  });

  revalidatePath(`/ops-dashboard/project/${projectId}`);
  return { txn, exit };
}

