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
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may submit a milestone payment request.");
  }
  if (!Number.isFinite(data.requestedAmount) || data.requestedAmount <= 0) {
    throw new Error("Enter a milestone amount greater than zero.");
  }
  const cp = await prisma.conditionPrecedent.findUnique({
    where: { projectId: data.projectId },
  });

  if (!cp || !cp.clearedForActivation) {
    throw new Error(
      "Cannot submit a milestone: Conditions Precedent (Gate G0) are not fully cleared."
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

  const assignedMonitors = await prisma.projectMonitor.findMany({
    where: { projectId: data.projectId, removedAt: null },
  });
  for (const appointment of assignedMonitors) {
    await prisma.monitorAssignment.create({
      data: {
        drawdownRequestId: request.id,
        projectId: data.projectId,
        monitorId: appointment.monitorId,
        assignedById: actor.id,
        phase: data.gateType,
        status: "ASSIGNED",
        initiatedAt: new Date(),
        assignedAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MILESTONE_SUBMITTED",
      details: `Milestone payment request submitted for ${data.gateType} at ₦${data.requestedAmount.toLocaleString()}.`,
    },
  });

  revalidatePath("/trustee-dashboard");
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
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may issue a deficiency notice.");
  }
  const existingNotice = await prisma.deficiencyNotice.findFirst({
    where: { drawdownRequestId: data.drawdownRequestId, isResolved: false },
  });

  if (existingNotice) {
    throw new Error(
      "FIDUCIARY RULE VIOLATION: A deficiency notice has already been issued for this milestone. Serial deficiency queries are strictly prohibited."
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

  revalidatePath("/trustee-dashboard");
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
  if (actor.role !== Role.INDEPENDENT_MONITOR) {
    throw new Error("Only an Independent Monitor may submit a milestone report.");
  }
  if (!data.notes.trim()) {
    throw new Error("Add your site observations before submitting the report.");
  }

  const current = await prisma.drawdownRequest.findUnique({
    where: { id: data.drawdownRequestId },
  });
  if (!current) throw new Error("Milestone request not found.");
  if (
    current.status === DrawdownStatus.APPROVED ||
    current.status === DrawdownStatus.PAID ||
    current.status === DrawdownStatus.REJECTED
  ) {
    throw new Error("This milestone is no longer open for a monitor report.");
  }

  const appointment = await prisma.projectMonitor.findFirst({
    where: {
      projectId: current.projectId,
      monitorId: actor.id,
      removedAt: null,
    },
  });
  if (!appointment) {
    throw new Error("You are not appointed to this project.");
  }

  const existingReport = await prisma.monitorCertificate.findFirst({
    where: { drawdownRequestId: data.drawdownRequestId, monitorId: actor.id },
  });
  if (existingReport) {
    throw new Error("You have already submitted a report for this milestone.");
  }

  const certificate = await prisma.monitorCertificate.create({
    data: {
      drawdownRequestId: data.drawdownRequestId,
      monitorId: actor.id,
      physicalProgressVerified: data.physicalProgressVerified,
      varianceFlagged: data.varianceFlagged,
      notes: data.notes.trim(),
      estimateAtCompletion: data.estimateAtCompletion,
      issuedAt: new Date(),
      certifiedAt: new Date(),
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

  // Complete only this monitor's assignment. Other assigned monitors keep their own status.
  const assignment = await prisma.monitorAssignment.findFirst({
    where: { drawdownRequestId: data.drawdownRequestId, monitorId: actor.id },
  });
  if (assignment) {
    await prisma.monitorAssignment.update({
      where: { id: assignment.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  }

  revalidatePath("/monitor-portal");
  revalidatePath("/trustee-dashboard");
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

  const suffix = project.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-6) || "NEW";
  await prisma.developer.create({
    data: {
      projectId: project.id,
      name: `${data.name} — Sponsor Developer`,
      contactEmail: "developer@example.com",
      pocName: "Project Sponsor",
      pocRole: "Development Principal",
    },
  });
  await Promise.all([
    prisma.bankAccount.create({
      data: {
        projectId: project.id,
        type: AccountType.PROJECT_INVESTMENT_ACCT,
        accountNumber: `01${suffix}11`,
        bankName: "First Trustees Escrow",
        balance: 0,
      },
    }),
    prisma.bankAccount.create({
      data: {
        projectId: project.id,
        type: AccountType.ASSET_PURCHASE_ACCT,
        accountNumber: `01${suffix}22`,
        bankName: "First Trustees Escrow",
        balance: 0,
      },
    }),
    prisma.bankAccount.create({
      data: {
        projectId: project.id,
        type: AccountType.PROJECT_EXECUTION_ACCT,
        accountNumber: `01${suffix}33`,
        bankName: "First Trustees Escrow",
        balance: 0,
      },
    }),
  ]);

  revalidatePath("/trustee-dashboard");
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

  revalidatePath("/trustee-dashboard");
  revalidatePath(`/trustee-dashboard/project/${data.projectId}`);
  return cp;
}

/* ---------------------------------------------------------------------------
 * MODULE 3 — Multi-step fiduciary approval workflow (Gates G1–G11)
 * ------------------------------------------------------------------------- */

export async function resolveDeficiency(drawdownRequestId: string) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may resolve a deficiency.");
  }
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
      details: `${notice.count} deficiency notice(s) resolved — milestone returned to SUBMITTED for re-evaluation.`,
    },
  });
  revalidatePath("/trustee-dashboard");
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
  revalidatePath("/trustee-dashboard");
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
  const buffer = Buffer.from(await file.arrayBuffer());

  // Local/dev and container builds can write to public/uploads. On read-only
  // serverless filesystems we fall back to an inline data URL so the evidence
  // link still opens in the browser (prototype-only, no object storage).
  let fileUrl = `/uploads/${safeName}`;
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, safeName), buffer);
  } catch {
    if (buffer.byteLength > 8 * 1024 * 1024) {
      throw new Error("Evidence could not be stored. Use a file under 8MB.");
    }
    fileUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  }

  const doc = await prisma.documentVault.create({
    data: {
      drawdownRequestId: drawdownRequestId || undefined,
      referenceId: drawdownRequestId || actor.id,
      documentType: isVideo ? DocumentType.SITE_VIDEO : DocumentType.SITE_PHOTO,
      s3Url: fileUrl,
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
  if (drawdownRequestId) revalidatePath(`/trustee-dashboard/project/${drawdownRequestId}`);
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
  revalidatePath("/trustee-dashboard/monitors");
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
    update: {
      eligibilityCriteriaMet: data.eligibilityCriteriaMet,
      appointedById: actor.id,
      removedAt: null,
    },
    create: {
      projectId: data.projectId,
      monitorId: data.monitorId,
      appointedById: actor.id,
      eligibilityCriteriaMet: data.eligibilityCriteriaMet,
      removedAt: null,
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

  const openMilestones = await prisma.drawdownRequest.findMany({
    where: {
      projectId: data.projectId,
      status: { in: [DrawdownStatus.SUBMITTED, DrawdownStatus.DEFICIENT] },
    },
  });
  for (const milestone of openMilestones) {
    const existing = await prisma.monitorAssignment.findFirst({
      where: { drawdownRequestId: milestone.id, monitorId: data.monitorId },
    });
    if (!existing) {
      await prisma.monitorAssignment.create({
        data: {
          drawdownRequestId: milestone.id,
          projectId: data.projectId,
          monitorId: data.monitorId,
          assignedById: actor.id,
          phase: milestone.gateType,
          status: "ASSIGNED",
          initiatedAt: new Date(),
          assignedAt: new Date(),
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      projectId: data.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MONITOR_APPOINTED",
      details: `Independent Monitor ${data.monitorId} assigned to the project and its open milestones. Eligibility criteria met: ${data.eligibilityCriteriaMet}.`,
    },
  });

  revalidatePath(`/trustee-dashboard/project/${data.projectId}`);
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
  revalidatePath(`/trustee-dashboard/project/${data.projectId}`);
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

  revalidatePath(`/trustee-dashboard/project/${projectId}`);
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
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may record an investor payment.");
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Amount must be positive.");
  }
  if (
    data.type !== CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION &&
    data.type !== CashTxnType.ASSET_PURCHASE_COLLECTION
  ) {
    throw new Error("Select a valid investor payment type.");
  }
  const account = await prisma.bankAccount.findUnique({
    where: { id: data.bankAccountId },
  });
  if (!account || account.projectId !== data.projectId) {
    throw new Error("Select a bank account that belongs to this project.");
  }

  const receiptRef = `FT-RCPT-${Date.now().toString(36).toUpperCase()}`;
  const txn = await prisma.cashTransaction.create({
    data: {
      projectId: data.projectId,
      bankAccountId: data.bankAccountId,
      type: data.type,
      direction: CashTxnDirection.IN,
      amount: data.amount,
      counterparty:
        data.type === CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION
          ? "Project investor payment"
          : "Asset purchase collection",
      method: "Bank transfer",
      status: "Completed",
      receiptRef,
      referenceId: receiptRef,
      note: data.note ?? "Payment received into the designated trust account.",
      recordedById: actor.id,
      recordedAt: new Date(),
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
      action: "INVESTOR_PAYMENT_RECEIVED",
      details: `Investor payment of ₦${data.amount.toLocaleString()} recorded in the designated trust account. Receipt ${receiptRef}.`,
    },
  });

  revalidatePath(`/trustee-dashboard/project/${data.projectId}`);
  return txn;
}

export async function executeInvestorDistribution(projectId: string) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may execute investor distributions.");
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

  const reference = `FT-EXIT-${Date.now().toString(36).toUpperCase()}`;
  const txn = await prisma.cashTransaction.create({
    data: {
      projectId,
      bankAccountId: investmentAcct.id,
      type: CashTxnType.INVESTOR_DISTRIBUTION,
      direction: CashTxnDirection.OUT,
      amount: payout,
      currency: "NGN",
      referenceId: reference,
      counterparty: "Project investors",
      method: "Bank transfer",
      status: "Completed",
      receiptRef: reference,
      note: `Investor withdrawal and payout — principal ₦${exit.principalAmount.toLocaleString()}, accrued ₦${exit.accruedReturn.toLocaleString()} (${exit.elapsedDays} days).`,
      recordedById: actor.id,
      recordedAt: new Date(),
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
      action: "INVESTOR_PAYOUT_COMPLETED",
      details: `Investor withdrawals and payouts completed: ₦${payout.toLocaleString()}. Reference ${reference}.`,
    },
  });

  revalidatePath(`/trustee-dashboard/project/${projectId}`);
  return { txn, exit };
}

/* ---------------------------------------------------------------------------
 * Trustee-facing capital & developer workflow
 *   1. See projects + investors
 *   2. Acknowledge confirmed investor payments and issue receipts
 *   3. Assign project monitors (project-level, not per milestone)
 *   4. Review monitor reports and decide on milestones
 *   5. Record milestone payments separately after approval
 * ------------------------------------------------------------------------- */

export async function acknowledgeInvestorPayment(investorId: string, paymentId?: string) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may acknowledge an investor payment.");
  }
  const inv = await prisma.investor.findUnique({ where: { id: investorId } });
  if (!inv) throw new Error("Investor not found.");

  const payments = await prisma.investorPayment.findMany({
    where: paymentId
      ? { id: paymentId, investorId }
      : { investorId, status: "RECEIVED" },
  });

  if (payments.length === 0) {
    throw new Error("This investor payment has already been acknowledged.");
  }

  let acknowledgedTotal = 0;
  const acknowledgedAt = new Date();
  for (const payment of payments) {
    if (payment.status === "ACKNOWLEDGED") continue;
    const receiptRef = `FT-${String(payment.reference).replace(/[^A-Za-z0-9]/g, "")}`;
    await prisma.investorPayment.update({
      where: { id: payment.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt,
        acknowledgedById: actor.id,
        receiptRef,
        notificationStatus: "SENT",
        notificationSentAt: acknowledgedAt,
      },
    });
    acknowledgedTotal += payment.amount;

    await prisma.notification.create({
      data: {
        projectId: payment.projectId,
        recipientType: "INVESTOR",
        recipientRef: inv.id,
        title: "Investor Payment Acknowledged",
        body: `First Trustees has acknowledged your payment of ₦${payment.amount.toLocaleString()} (reference ${payment.reference}). Receipt ${receiptRef} has been issued.`,
        relatedDrawdownId: null,
        createdAt: acknowledgedAt,
      },
    });
  }

  if (acknowledgedTotal === 0) {
    throw new Error("This investor payment has already been acknowledged.");
  }

  const updated = await prisma.investor.update({
    where: { id: investorId },
    data: { paymentStatus: "ACKNOWLEDGED", acknowledgedAt },
  });

  await prisma.auditLog.create({
    data: {
      projectId: updated.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "INVESTOR_PAYMENT_ACKNOWLEDGED",
      details: `Trustee acknowledged ₦${acknowledgedTotal.toLocaleString()} received from ${updated.name}. Acknowledgement notification sent to the investor application.`,
      timestamp: acknowledgedAt,
    },
  });

  revalidatePath("/trustee-dashboard");
  revalidatePath("/trustee-dashboard/portfolio");
  revalidatePath(`/trustee-dashboard/project/${updated.projectId}`);
  return updated;
}

export async function approveMilestone(drawdownRequestId: string, comment = "") {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may approve a milestone.");
  }
  const req = await prisma.drawdownRequest.findUnique({
    where: { id: drawdownRequestId },
    include: { monitorCertificates: true },
  });
  if (!req) throw new Error("Milestone request not found.");
  if (req.status === DrawdownStatus.PAID) {
    throw new Error("This milestone has already been paid.");
  }
  if (req.status === DrawdownStatus.APPROVED) {
    throw new Error("This milestone is already approved and awaiting payment.");
  }
  if (req.status === DrawdownStatus.REJECTED) {
    throw new Error("A rejected milestone cannot be approved. The developer must resubmit.");
  }
  if (req.monitorCertificates.length === 0) {
    throw new Error(
      "CONTROL GATE: An Independent Monitor report is required before the Trustee can approve this milestone."
    );
  }

  const reviewedAt = new Date();
  const reviewComment =
    comment.trim() ||
    "Monitor report and supporting evidence reviewed. Milestone approved for payment.";

  const updated = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: {
      status: DrawdownStatus.APPROVED,
      reviewComment,
      reviewedById: actor.id,
      reviewedAt,
    },
  });

  const dev = await prisma.developer.findFirst({ where: { projectId: updated.projectId } });
  if (dev) {
    await prisma.notification.create({
      data: {
        projectId: updated.projectId,
        recipientType: "DEVELOPER",
        recipientRef: dev.id,
        title: "Milestone Approved — Payment Pending",
        body: `The Trustee approved the ${req.gateType} milestone for ₦${req.requestedAmount.toLocaleString()}. The milestone is now eligible for payment; funds have not yet been released.`,
        relatedDrawdownId: drawdownRequestId,
        createdAt: reviewedAt,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: updated.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MILESTONE_APPROVED",
      details: `${req.gateType} approved for payment. Review comment: ${reviewComment}`,
      timestamp: reviewedAt,
    },
  });

  revalidatePath("/trustee-dashboard");
  revalidatePath(`/trustee-dashboard/project/${updated.projectId}`);
  revalidatePath("/monitor-portal");
  return updated;
}

/** Backwards-compatible wrapper for older callers. */
export async function confirmAndNotifyDeveloper(drawdownRequestId: string) {
  return approveMilestone(drawdownRequestId);
}

export async function processMilestonePayment(data: {
  drawdownRequestId: string;
  amount: number;
  recipient: string;
  method: string;
  reference: string;
  paymentDate: Date;
  notes?: string;
}) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may process a milestone payment.");
  }
  const request = await prisma.drawdownRequest.findUnique({
    where: { id: data.drawdownRequestId },
  });
  if (!request) throw new Error("Milestone request not found.");
  if (request.status !== DrawdownStatus.APPROVED) {
    throw new Error(
      "CONTROL GATE: Only an approved milestone can be paid. Approve the milestone first."
    );
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.");
  }
  if (data.amount > request.requestedAmount) {
    throw new Error("Payment cannot exceed the approved milestone allocation.");
  }
  if (!data.recipient.trim()) throw new Error("Enter the payment recipient.");
  if (!data.reference.trim()) throw new Error("Enter a payment reference.");
  if (!data.method.trim()) throw new Error("Enter the payment method.");

  const duplicate = await prisma.drawdownRequest.findFirst({
    where: { paymentReference: data.reference.trim() },
  });
  if (duplicate && duplicate.id !== request.id) {
    throw new Error("That payment reference has already been used. Use a unique reference.");
  }

  const paymentDate = new Date(data.paymentDate);
  const paidAt = new Date();
  const reference = data.reference.trim();
  const notes = data.notes?.trim() || "Milestone payment processed by the Trustee.";

  const sourceAcct = await prisma.bankAccount.findFirst({
    where: { projectId: request.projectId, type: AccountType.PROJECT_INVESTMENT_ACCT },
  });
  const executionAcct = await prisma.bankAccount.findFirst({
    where: { projectId: request.projectId, type: AccountType.PROJECT_EXECUTION_ACCT },
  });
  if (!sourceAcct) throw new Error("Project Investment Account not found.");

  if (sourceAcct.balance < data.amount) {
    throw new Error("Insufficient balance in the Project Investment Account for this payment.");
  }

  await prisma.bankAccount.update({
    where: { id: sourceAcct.id },
    data: { balance: { decrement: data.amount } },
  });
  if (executionAcct) {
    await prisma.bankAccount.update({
      where: { id: executionAcct.id },
      data: { balance: { increment: data.amount } },
    });
  }

  await prisma.cashTransaction.create({
    data: {
      projectId: request.projectId,
      bankAccountId: sourceAcct.id,
      type: CashTxnType.DRAWDOWN_DISBURSEMENT,
      direction: CashTxnDirection.OUT,
      amount: data.amount,
      currency: "NGN",
      referenceId: reference,
      counterparty: data.recipient.trim(),
      method: data.method.trim(),
      status: "Completed",
      receiptRef: reference,
      note: `Milestone payment to ${data.recipient.trim()} for ${request.gateType}. ${notes}`,
      recordedById: actor.id,
      recordedAt: paidAt,
    },
  });
  if (executionAcct) {
    await prisma.cashTransaction.create({
      data: {
        projectId: request.projectId,
        bankAccountId: executionAcct.id,
        type: CashTxnType.DRAWDOWN_DISBURSEMENT,
        direction: CashTxnDirection.IN,
        amount: data.amount,
        currency: "NGN",
        referenceId: reference,
        counterparty: "Project Execution Account",
        method: "Internal transfer",
        status: "Completed",
        receiptRef: reference,
        note: `Internal transfer of the approved milestone payment for ${request.gateType}.`,
        recordedById: actor.id,
        recordedAt: paidAt,
      },
    });
  }

  const updated = await prisma.drawdownRequest.update({
    where: { id: request.id },
    data: {
      status: DrawdownStatus.PAID,
      paymentRecipient: data.recipient.trim(),
      paymentMethod: data.method.trim(),
      paymentReference: reference,
      paymentDate,
      paymentNotes: notes,
      paidById: actor.id,
      paidAt,
    },
  });

  const dev = await prisma.developer.findFirst({ where: { projectId: request.projectId } });
  if (dev) {
    await prisma.notification.create({
      data: {
        projectId: request.projectId,
        recipientType: "DEVELOPER",
        recipientRef: dev.id,
        title: "Milestone Payment Receipt",
        body: `Payment of ₦${data.amount.toLocaleString()} for ${request.gateType} has been recorded. Reference ${reference}. Receipt ${reference} issued by First Trustees.`,
        relatedDrawdownId: request.id,
        createdAt: paidAt,
      },
    });
  }
  const investors = await prisma.investor.findMany({ where: { projectId: request.projectId } });
  for (const inv of investors) {
    await prisma.notification.create({
      data: {
        projectId: request.projectId,
        recipientType: "INVESTOR",
        recipientRef: inv.id,
        title: "Milestone Payment Completed",
        body: `A milestone payment of ₦${data.amount.toLocaleString()} for ${request.gateType} has been paid to the developer. Your capital record has been updated.`,
        relatedDrawdownId: request.id,
        createdAt: paidAt,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: request.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MILESTONE_PAYMENT_COMPLETED",
      details: `Milestone payment of ₦${data.amount.toLocaleString()} to ${data.recipient.trim()} recorded with reference ${reference}.`,
      timestamp: paidAt,
    },
  });

  revalidatePath("/trustee-dashboard");
  revalidatePath(`/trustee-dashboard/project/${request.projectId}`);
  revalidatePath("/trustee-dashboard/portfolio");
  return updated;
}

export async function rejectMilestone(drawdownRequestId: string, reason: string) {
  const actor = await currentActor();
  if (actor.role !== Role.FIDUCIARY_EXEC) {
    throw new Error("Only a Trustee may reject a milestone.");
  }
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new Error("Provide a reason (at least 5 characters) for rejecting this milestone.");
  }

  const request = await prisma.drawdownRequest.findUnique({
    where: { id: drawdownRequestId },
  });
  if (!request) throw new Error("Milestone request not found.");
  if (request.status === DrawdownStatus.PAID) {
    throw new Error("This milestone has already been paid and cannot be rejected.");
  }

  const updated = await prisma.drawdownRequest.update({
    where: { id: drawdownRequestId },
    data: {
      status: DrawdownStatus.REJECTED,
      reviewComment: cleanReason,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });

  const dev = await prisma.developer.findFirst({ where: { projectId: updated.projectId } });
  if (dev) {
    await prisma.notification.create({
      data: {
        projectId: updated.projectId,
        recipientType: "DEVELOPER",
        recipientRef: dev.id,
        title: "Milestone Funding Rejected",
        body: `The Trustee rejected the funding request for ${request.gateType}. Reason: ${cleanReason}`,
        relatedDrawdownId: request.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId: updated.projectId,
      actorId: actor.id,
      actorName: actor.name,
      action: "MILESTONE_REJECTED",
      details: `Milestone ${request.gateType} rejected: ${cleanReason}`,
      timestamp: new Date(),
    },
  });

  revalidatePath("/trustee-dashboard");
  revalidatePath(`/trustee-dashboard/project/${updated.projectId}`);
  return updated;
}

