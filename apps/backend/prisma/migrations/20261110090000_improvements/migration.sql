-- Melhorias: ciclos, relações e anexos no quadro; o consumo e o limite da IA; os documentos usados; as regras em conflito; o snapshot antes dos comandos; as tentativas automáticas do estudo.
-- CreateEnum
CREATE TYPE "TaskRelationKind" AS ENUM ('BLOCKS', 'RELATES', 'DUPLICATES');

-- AlterTable
ALTER TABLE "AgentScheduleRun" ADD COLUMN     "docsUsed" JSONB;

-- AlterTable
ALTER TABLE "AiCredential" ADD COLUMN     "budgetWarnedAt" TEXT,
ADD COLUMN     "monthlyBudget" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "studyRetries" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BoardTask" ADD COLUMN     "cycleId" TEXT;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "docsUsed" JSONB;

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "conflicts" JSONB,
ADD COLUMN     "conflictsCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServerCommand" ADD COLUMN     "snapshotName" TEXT;

-- CreateTable
CREATE TABLE "BoardCycle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" "TaskRelationKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardCycle_projectId_startDate_idx" ON "BoardCycle"("projectId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTaskRelation_fromId_toId_kind_key" ON "BoardTaskRelation"("fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "BoardTaskAttachment_taskId_idx" ON "BoardTaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "AiUsage_userId_day_idx" ON "AiUsage"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_day_agentKey_model_source_key" ON "AiUsage"("userId", "day", "agentKey", "model", "source");

-- AddForeignKey
ALTER TABLE "BoardTask" ADD CONSTRAINT "BoardTask_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BoardCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardCycle" ADD CONSTRAINT "BoardCycle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskRelation" ADD CONSTRAINT "BoardTaskRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskRelation" ADD CONSTRAINT "BoardTaskRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskAttachment" ADD CONSTRAINT "BoardTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

