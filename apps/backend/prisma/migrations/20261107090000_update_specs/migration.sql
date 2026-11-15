-- AlterEnum
ALTER TYPE "AppUpdateStatus" ADD VALUE 'VERIFYING';

-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "afterChecks" JSONB,
ADD COLUMN     "spec" TEXT,
ADD COLUMN     "specDocs" JSONB,
ADD COLUMN     "stepTasks" JSONB,
ADD COLUMN     "verifyStartedAt" TIMESTAMP(3);

-- O agente de infraestrutura verifica o "depois de atualizar" com update_verify.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['update_verify']::TEXT[], "updatedAt" = NOW()
WHERE 'update_prepare' = ANY("tools") AND NOT ('update_verify' = ANY("tools"));
