import {
  PrismaClient,
  Role,
  ProjectStatus,
  GateType,
  DrawdownStatus,
  AccountType,
  CashTxnType,
  CashTxnDirection,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Project", "BankAccount", "ConditionPrecedent", "DrawdownRequest", "DeficiencyNotice", "MonitorCertificate", "DocumentVault", "AuditLog", "MonitorCredential", "ProjectMonitor", "CashTransaction" CASCADE;`
  );

  // 1. Create Users
  const fiduExec = await prisma.user.create({
    data: {
      name: "Adewale Fiduciary Lead",
      email: "fiduciary@firsttrustees.com",
      hashedPassword: "hashed_pass",
      role: Role.FIDUCIARY_EXEC,
    },
  });

  const monitor = await prisma.user.create({
    data: {
      name: "Engr. Kabir (Independent Monitor)",
      email: "monitor@tech-cert.org",
      hashedPassword: "hashed_pass",
      role: Role.INDEPENDENT_MONITOR,
    },
  });

  // Monitor professional standing (COREN registration, PI insurance)
  await prisma.monitorCredential.create({
    data: {
      userId: monitor.id,
      professionalBody: "COREN",
      registrationNumber: "RCOREN-22981",
      experienceSummary:
        "15+ years independent monitoring of mixed-use and residential developments across Lagos and Abuja at comparable scale.",
      piInsuranceVerified: true,
      piInsuranceDocUrl: "/uploads/pi-insurance-sample.pdf",
      kycStatus: "UNDER_REVIEW",
    },
  });

  await prisma.documentVault.createMany({
    data: [
      {
        referenceId: monitor.id,
        documentType: "MONITOR_ID",
        s3Url: "/uploads/monitor-id-sample.pdf",
        fileName: "National ID - Engr. Kabir.pdf",
      },
      {
        referenceId: monitor.id,
        documentType: "PROFESSIONAL_LICENSE",
        s3Url: "/uploads/professional-license-sample.pdf",
        fileName: "COREN License Certificate.pdf",
      },
      {
        referenceId: monitor.id,
        documentType: "PI_INSURANCE",
        s3Url: "/uploads/pi-insurance-sample.pdf",
        fileName: "Professional Indemnity Cover Note.pdf",
      },
    ],
  });

  // 2. Create Project
  const fundingCloseDate = new Date();
  fundingCloseDate.setDate(fundingCloseDate.getDate() - 120); // 120 days ago

  const project = await prisma.project.create({
    data: {
      name: "SYNDESIS Purple&Grey / Harbor Alpha",
      code: "SYND-HARBOR-001",
      status: ProjectStatus.ACTIVE,
      totalBudget: 1200000000.0,
      fundingCloseDate,
      targetCompletion: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. Create CPs
  await prisma.conditionPrecedent.create({
    data: {
      projectId: project.id,
      masterScheduleExecuted: true,
      landRegistryLienRegistered: true,
      boqApproved: true,
      minimumFundingMet: true,
      insuranceVerified: true,
      clearedForActivation: true,
      activatedAt: fundingCloseDate,
    },
  });

  // 4. Create Bank Accounts (balances built from recorded trust inflows)
  const investmentAcct = await prisma.bankAccount.create({
    data: {
      projectId: project.id,
      type: AccountType.PROJECT_INVESTMENT_ACCT,
      accountNumber: "1029384756",
      bankName: "First Bank of Nigeria",
      balance: 450000000.0,
    },
  });
  const assetAcct = await prisma.bankAccount.create({
    data: {
      projectId: project.id,
      type: AccountType.ASSET_PURCHASE_ACCT,
      accountNumber: "1029384767",
      bankName: "First Bank of Nigeria",
      balance: 225000000.0,
    },
  });
  const executionAcct = await prisma.bankAccount.create({
    data: {
      projectId: project.id,
      type: AccountType.PROJECT_EXECUTION_ACCT,
      accountNumber: "5060708090",
      bankName: "Zenith Bank",
      balance: 0.0,
    },
  });

  // 4b. Independent cash ledger — subscriptions & asset-purchase collections safeguarded
  await prisma.cashTransaction.createMany({
    data: [
      {
        projectId: project.id,
        bankAccountId: investmentAcct.id,
        type: CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION,
        direction: CashTxnDirection.IN,
        amount: 450000000.0,
        note: "Project Investor subscriptions received and safeguarded in trust.",
        recordedById: fiduExec.id,
      },
      {
        projectId: project.id,
        bankAccountId: assetAcct.id,
        type: CashTxnType.ASSET_PURCHASE_COLLECTION,
        direction: CashTxnDirection.IN,
        amount: 225000000.0,
        note: "Asset purchase collections received and safeguarded in trust.",
        recordedById: fiduExec.id,
      },
    ],
  });

  // 4c. First Trustees appoints the Independent Monitor + signed declaration
  await prisma.projectMonitor.create({
    data: {
      projectId: project.id,
      monitorId: monitor.id,
      appointedById: fiduExec.id,
      eligibilityCriteriaMet: true,
      independenceDeclarationSigned: true,
      declarationDocUrl: "/uploads/monitor-declaration-sample.pdf",
    },
  });

  // 5. Create Drawdowns
  const slaDeadline = new Date();
  slaDeadline.setDate(slaDeadline.getDate() + 2);

  await prisma.drawdownRequest.create({
    data: {
      projectId: project.id,
      requestedById: fiduExec.id,
      gateType: GateType.G2_SUBSTRUCTURE,
      requestedAmount: 45000000.0,
      status: DrawdownStatus.SUBMITTED,
      slaDeadline,
    },
  });

  // 6. A second, older drawdown to demonstrate SLA risk states
  const breachedDeadline = new Date();
  breachedDeadline.setDate(breachedDeadline.getDate() - 1);

  await prisma.drawdownRequest.create({
    data: {
      projectId: project.id,
      requestedById: fiduExec.id,
      gateType: GateType.G1_PRELIM_PROCUREMENT_01,
      requestedAmount: 12000000.0,
      status: DrawdownStatus.DEFICIENT,
      slaDeadline: breachedDeadline,
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: project.id,
      actorId: fiduExec.id,
      actorName: fiduExec.name,
      action: "PROJECT_ACTIVATED",
      details: "Conditions Precedent cleared; project activated and Funding Close Date locked.",
    },
  });

  console.log("SYNDESIS Fiduciary Database successfully seeded.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
