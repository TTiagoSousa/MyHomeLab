-- AlterEnum
ALTER TYPE "DocProposalAction" ADD VALUE 'ORGANIZE';

-- AlterTable
ALTER TABLE "DocProposal" ADD COLUMN     "organize" JSONB;

