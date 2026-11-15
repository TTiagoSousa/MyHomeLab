-- O quadro de tarefas do MyHomeLab (substitui o Plane): projetos com colunas e módulos, tarefas, comentários, links e histórico.
-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('GENERAL', 'UPDATES');

-- CreateEnum
CREATE TYPE "BoardStateGroup" AS ENUM ('BACKLOG', 'UNSTARTED', 'STARTED', 'WAITING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- DropForeignKey
ALTER TABLE "UpdateWorkflowSetting" DROP CONSTRAINT "UpdateWorkflowSetting_boardAccountId_fkey";

-- AlterTable
ALTER TABLE "AppUpdate" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "color" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "identifier" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "nextNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UpdateWorkflowSetting" DROP COLUMN "boardAccountId",
DROP COLUMN "boardProjectId",
DROP COLUMN "boardProjectName",
ALTER COLUMN "boardModules" SET DEFAULT ARRAY['Servidor']::TEXT[];

-- CreateTable
CREATE TABLE "BoardState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "BoardStateGroup" NOT NULL DEFAULT 'UNSTARTED',
    "color" TEXT NOT NULL DEFAULT '#8a94a6',
    "position" INTEGER NOT NULL DEFAULT 0,
    "key" TEXT,

    CONSTRAINT "BoardState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardModule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "stateId" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NONE',
    "assignee" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "parentId" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "updateId" TEXT,
    "reminderUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskModule" (
    "taskId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "BoardTaskModule_pkey" PRIMARY KEY ("taskId","moduleId")
);

-- CreateTable
CREATE TABLE "BoardTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardState_projectId_position_idx" ON "BoardState"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BoardState_projectId_key_key" ON "BoardState"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BoardModule_projectId_name_key" ON "BoardModule"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTask_updateId_key" ON "BoardTask"("updateId");

-- CreateIndex
CREATE INDEX "BoardTask_userId_idx" ON "BoardTask"("userId");

-- CreateIndex
CREATE INDEX "BoardTask_stateId_idx" ON "BoardTask"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTask_projectId_number_key" ON "BoardTask"("projectId", "number");

-- CreateIndex
CREATE INDEX "BoardTaskComment_taskId_createdAt_idx" ON "BoardTaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "BoardTaskLink_taskId_idx" ON "BoardTaskLink"("taskId");

-- CreateIndex
CREATE INDEX "BoardTaskActivity_taskId_createdAt_idx" ON "BoardTaskActivity"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "BoardState" ADD CONSTRAINT "BoardState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardModule" ADD CONSTRAINT "BoardModule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTask" ADD CONSTRAINT "BoardTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTask" ADD CONSTRAINT "BoardTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTask" ADD CONSTRAINT "BoardTask_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "BoardState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTask" ADD CONSTRAINT "BoardTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BoardTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskModule" ADD CONSTRAINT "BoardTaskModule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskModule" ADD CONSTRAINT "BoardTaskModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "BoardModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskComment" ADD CONSTRAINT "BoardTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskLink" ADD CONSTRAINT "BoardTaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskActivity" ADD CONSTRAINT "BoardTaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BoardTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- As tarefas antigas eram do Plane: deixam de valer.
UPDATE "AppUpdate" SET "boardTaskId" = NULL, "boardTaskKey" = NULL, "boardError" = NULL, "stepTasks" = NULL;

-- Os comandos deixam de esperar por aprovação: saem as ferramentas de aprovar e recusar.
UPDATE "Agent" SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t NOT IN ('server_run_approved', 'server_reject_command')), "updatedAt" = NOW() WHERE "tools" && ARRAY['server_run_approved', 'server_reject_command']::TEXT[];
UPDATE "ServerCommand" SET "status" = 'REJECTED', "decidedAt" = NOW() WHERE "status" = 'PENDING';
