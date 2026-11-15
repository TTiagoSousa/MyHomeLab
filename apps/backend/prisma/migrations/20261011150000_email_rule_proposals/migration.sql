-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'DISMISSED', 'IMPLEMENTED');

-- AlterEnum
ALTER TYPE "RunFrequency" ADD VALUE 'WEEKLY';

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "autoImplementProposalsAfterDays" INTEGER,
ADD COLUMN     "lastProposalRunAt" TIMESTAMP(3),
ADD COLUMN     "proposalFrequency" "RunFrequency";

-- CreateTable
CREATE TABLE "EmailRuleProposal" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "implementedRuleId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRuleProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailRuleProposal_accountId_status_idx" ON "EmailRuleProposal"("accountId", "status");

-- AddForeignKey
ALTER TABLE "EmailRuleProposal" ADD CONSTRAINT "EmailRuleProposal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

