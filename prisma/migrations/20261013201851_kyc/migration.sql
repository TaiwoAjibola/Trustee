-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'MONITOR_ID';
ALTER TYPE "DocumentType" ADD VALUE 'PROFESSIONAL_LICENSE';

-- AlterTable
ALTER TABLE "MonitorCredential" ADD COLUMN     "kycNote" TEXT,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING';
