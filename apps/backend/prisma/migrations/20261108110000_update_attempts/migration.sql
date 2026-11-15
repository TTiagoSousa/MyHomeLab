-- Tentativas de atualização: os pontos das regras e o que o agente validou.
-- CreateEnum
CREATE TYPE "UpdateAttemptStatus" AS ENUM ('CHECKING', 'RUNNING', 'VERIFYING', 'DONE', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "UpdateCheckPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "UpdateCheckState" AS ENUM ('PENDING', 'VALIDATED', 'NOT_VALIDATED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "UpdateAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "toVersion" TEXT NOT NULL,
    "status" "UpdateAttemptStatus" NOT NULL DEFAULT 'CHECKING',
    "docs" JSONB,
    "result" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "UpdateAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpdateAttemptCheck" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "phase" "UpdateCheckPhase" NOT NULL,
    "point" TEXT NOT NULL,
    "proof" TEXT,
    "source" TEXT,
    "who" TEXT NOT NULL DEFAULT 'agent',
    "state" "UpdateCheckState" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "UpdateAttemptCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpdateAttempt_userId_startedAt_idx" ON "UpdateAttempt"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "UpdateAttempt_accountId_startedAt_idx" ON "UpdateAttempt"("accountId", "startedAt");

-- CreateIndex
CREATE INDEX "UpdateAttempt_updateId_idx" ON "UpdateAttempt"("updateId");

-- CreateIndex
CREATE INDEX "UpdateAttemptCheck_attemptId_position_idx" ON "UpdateAttemptCheck"("attemptId", "position");

-- AddForeignKey
ALTER TABLE "UpdateAttempt" ADD CONSTRAINT "UpdateAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateAttempt" ADD CONSTRAINT "UpdateAttempt_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "AppUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateAttempt" ADD CONSTRAINT "UpdateAttempt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateAttemptCheck" ADD CONSTRAINT "UpdateAttemptCheck_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "UpdateAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Quem prepara as atualizações marca os pontos da tentativa.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['update_check']::TEXT[], "updatedAt" = NOW()
WHERE 'update_prepare' = ANY("tools") AND NOT ('update_check' = ANY("tools"));
