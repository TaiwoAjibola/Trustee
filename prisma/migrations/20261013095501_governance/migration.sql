-- CreateEnum
CREATE TYPE "CashTxnType" AS ENUM ('PROJECT_INVESTMENT_SUBSCRIPTION', 'ASSET_PURCHASE_COLLECTION', 'DRAWDOWN_DISBURSEMENT', 'MONITOR_FEE', 'INVESTOR_DISTRIBUTION', 'STALL_REMEDY_SALE');

-- CreateEnum
CREATE TYPE "CashTxnDirection" AS ENUM ('IN', 'OUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'SITE_PHOTO';
ALTER TYPE "DocumentType" ADD VALUE 'SITE_VIDEO';
ALTER TYPE "DocumentType" ADD VALUE 'MONITOR_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE 'PI_INSURANCE';

-- AlterTable
ALTER TABLE "ConditionPrecedent" ADD COLUMN     "lienVacated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lienVacatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MonitorCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalBody" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "experienceSummary" TEXT,
    "piInsuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "piInsuranceDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMonitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "appointedById" TEXT NOT NULL,
    "eligibilityCriteriaMet" BOOLEAN NOT NULL DEFAULT false,
    "independenceDeclarationSigned" BOOLEAN NOT NULL DEFAULT false,
    "declarationDocUrl" TEXT,
    "appointedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "type" "CashTxnType" NOT NULL,
    "direction" "CashTxnDirection" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "referenceId" TEXT,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitorCredential_userId_key" ON "MonitorCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMonitor_projectId_monitorId_key" ON "ProjectMonitor"("projectId", "monitorId");

-- AddForeignKey
ALTER TABLE "MonitorCredential" ADD CONSTRAINT "MonitorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMonitor" ADD CONSTRAINT "ProjectMonitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMonitor" ADD CONSTRAINT "ProjectMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
