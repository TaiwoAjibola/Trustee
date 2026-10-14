-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPS_ANALYST', 'OPS_LEAD', 'FIDUCIARY_EXEC', 'INDEPENDENT_MONITOR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING_CP', 'ACTIVE', 'STALLED', 'WIND_DOWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GateType" AS ENUM ('G0_FUNDING_CLOSE', 'G1_PRELIM_PROCUREMENT_01', 'G2_SUBSTRUCTURE', 'G3_SUPERSTRUCTURE', 'G4_ROOF', 'G5_PROCUREMENT_02', 'G6_MEP_FINISHES', 'G7_PROCUREMENT_03', 'G8_MEP_FURNITURE', 'G9_PRACTICAL_COMPLETION', 'G10_INVESTOR_EXIT', 'G11_CLOSEOUT');

-- CreateEnum
CREATE TYPE "DrawdownStatus" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'DEFICIENT', 'CERTIFIED_BY_MONITOR', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PROJECT_INVESTMENT_ACCT', 'ASSET_PURCHASE_ACCT', 'PROJECT_EXECUTION_ACCT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CERTIFICATE', 'PO', 'INVOICE', 'VENDOR_KYC', 'TITLE_DEED', 'LAND_REGISTRY_LIEN', 'BOQ_SPECIFICATION', 'SNAG_LIST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING_CP',
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "fundingCloseDate" TIMESTAMP(3),
    "targetCompletion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionPrecedent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "masterScheduleExecuted" BOOLEAN NOT NULL DEFAULT false,
    "landRegistryLienRegistered" BOOLEAN NOT NULL DEFAULT false,
    "boqApproved" BOOLEAN NOT NULL DEFAULT false,
    "minimumFundingMet" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "clearedForActivation" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "ConditionPrecedent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawdownRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "gateType" "GateType" NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "status" "DrawdownStatus" NOT NULL DEFAULT 'SUBMITTED',
    "estimateAtCompletion" DOUBLE PRECISION,
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawdownRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeficiencyNotice" (
    "id" TEXT NOT NULL,
    "drawdownRequestId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "consolidatedMessage" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeficiencyNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorCertificate" (
    "id" TEXT NOT NULL,
    "drawdownRequestId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "physicalProgressVerified" BOOLEAN NOT NULL,
    "varianceFlagged" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVault" (
    "id" TEXT NOT NULL,
    "drawdownRequestId" TEXT,
    "referenceId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "s3Url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionPrecedent_projectId_key" ON "ConditionPrecedent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_accountNumber_key" ON "BankAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "DrawdownRequest_projectId_status_idx" ON "DrawdownRequest"("projectId", "status");

-- AddForeignKey
ALTER TABLE "ConditionPrecedent" ADD CONSTRAINT "ConditionPrecedent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawdownRequest" ADD CONSTRAINT "DrawdownRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawdownRequest" ADD CONSTRAINT "DrawdownRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeficiencyNotice" ADD CONSTRAINT "DeficiencyNotice_drawdownRequestId_fkey" FOREIGN KEY ("drawdownRequestId") REFERENCES "DrawdownRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeficiencyNotice" ADD CONSTRAINT "DeficiencyNotice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorCertificate" ADD CONSTRAINT "MonitorCertificate_drawdownRequestId_fkey" FOREIGN KEY ("drawdownRequestId") REFERENCES "DrawdownRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorCertificate" ADD CONSTRAINT "MonitorCertificate_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVault" ADD CONSTRAINT "DocumentVault_drawdownRequestId_fkey" FOREIGN KEY ("drawdownRequestId") REFERENCES "DrawdownRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
