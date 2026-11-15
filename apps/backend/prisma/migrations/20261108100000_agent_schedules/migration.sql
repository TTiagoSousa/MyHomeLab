-- Agendamentos dos agentes: trabalhos que correm sozinhos numa data ou repetidos.
-- CreateEnum
CREATE TYPE "AgentScheduleRepeat" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AgentScheduleRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'AGENT_NOTICE';

-- CreateTable
CREATE TABLE "AgentSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "repeat" "AgentScheduleRepeat" NOT NULL DEFAULT 'ONCE',
    "runAt" TIMESTAMP(3),
    "time" TEXT,
    "weekday" INTEGER,
    "monthDay" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "linkType" "DocLinkType",
    "targetId" TEXT,
    "targetLabel" TEXT,
    "updateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentScheduleRun" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "status" "AgentScheduleRunStatus" NOT NULL DEFAULT 'RUNNING',
    "summary" TEXT,
    "notice" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSchedule_updateId_key" ON "AgentSchedule"("updateId");

-- CreateIndex
CREATE INDEX "AgentSchedule_enabled_nextRunAt_idx" ON "AgentSchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "AgentSchedule_userId_idx" ON "AgentSchedule"("userId");

-- CreateIndex
CREATE INDEX "AgentSchedule_linkType_targetId_idx" ON "AgentSchedule"("linkType", "targetId");

-- CreateIndex
CREATE INDEX "AgentScheduleRun_scheduleId_startedAt_idx" ON "AgentScheduleRun"("scheduleId", "startedAt");

-- AddForeignKey
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "AppUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentScheduleRun" ADD CONSTRAINT "AgentScheduleRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AgentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- O CEO e o Engenheiro de Infraestrutura podem criar e mudar agendamentos.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['schedule_list', 'schedule_create', 'schedule_update', 'schedule_delete']::TEXT[], "updatedAt" = NOW()
WHERE "key" IN ('ceo', 'infra') AND NOT ('schedule_list' = ANY("tools"));
