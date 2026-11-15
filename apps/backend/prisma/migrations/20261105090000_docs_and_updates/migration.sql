-- CreateEnum
CREATE TYPE "DocKind" AS ENUM ('RULES', 'CHECKLIST', 'NOTES', 'LEARNINGS', 'GUIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocOwner" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "DocLinkType" AS ENUM ('SERVER', 'GUEST', 'APP', 'MONITOR', 'AGENT', 'DOC');

-- CreateEnum
CREATE TYPE "DocProposalAction" AS ENUM ('EDIT', 'APPEND', 'CREATE');

-- CreateEnum
CREATE TYPE "DocProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppUpdateStatus" AS ENUM ('STUDY', 'TODO', 'WAITING', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "ServerCommand" ADD COLUMN     "updateId" TEXT;


-- CreateTable
CREATE TABLE "Doc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL DEFAULT 'NOTES',
    "owner" "DocOwner" NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocLink" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "type" "DocLinkType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "DocLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocVersion" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docId" TEXT,
    "action" "DocProposalAction" NOT NULL,
    "title" TEXT,
    "kind" "DocKind",
    "content" TEXT NOT NULL,
    "reason" TEXT,
    "links" JSONB,
    "proposedBy" TEXT NOT NULL,
    "status" "DocProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "DocProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUpdate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "toVersion" TEXT NOT NULL,
    "releaseUrl" TEXT,
    "status" "AppUpdateStatus" NOT NULL DEFAULT 'STUDY',
    "study" TEXT,
    "risk" TEXT,
    "recommendation" TEXT,
    "question" TEXT,
    "studyStartedAt" TIMESTAMP(3),
    "studiedAt" TIMESTAMP(3),
    "studyError" TEXT,
    "boardTaskId" TEXT,
    "boardTaskKey" TEXT,
    "boardError" TEXT,
    "serverConnectionId" TEXT,
    "guestVmid" INTEGER,
    "commands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commandId" TEXT,
    "snapshotName" TEXT,
    "checks" JSONB,
    "result" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpdateWorkflowSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoStudy" BOOLEAN NOT NULL DEFAULT true,
    "boardAccountId" TEXT,
    "boardProjectId" TEXT,
    "boardProjectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpdateWorkflowSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Doc_userId_idx" ON "Doc"("userId");

-- CreateIndex
CREATE INDEX "DocLink_type_targetId_idx" ON "DocLink"("type", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "DocLink_docId_type_targetId_key" ON "DocLink"("docId", "type", "targetId");

-- CreateIndex
CREATE INDEX "DocVersion_docId_createdAt_idx" ON "DocVersion"("docId", "createdAt");

-- CreateIndex
CREATE INDEX "DocProposal_userId_status_idx" ON "DocProposal"("userId", "status");

-- CreateIndex
CREATE INDEX "AppUpdate_userId_status_idx" ON "AppUpdate"("userId", "status");

-- CreateIndex
CREATE INDEX "AppUpdate_accountId_idx" ON "AppUpdate"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateWorkflowSetting_userId_key" ON "UpdateWorkflowSetting"("userId");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLink" ADD CONSTRAINT "DocLink_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocVersion" ADD CONSTRAINT "DocVersion_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocProposal" ADD CONSTRAINT "DocProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocProposal" ADD CONSTRAINT "DocProposal_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUpdate" ADD CONSTRAINT "AppUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUpdate" ADD CONSTRAINT "AppUpdate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateWorkflowSetting" ADD CONSTRAINT "UpdateWorkflowSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateWorkflowSetting" ADD CONSTRAINT "UpdateWorkflowSetting_boardAccountId_fkey" FOREIGN KEY ("boardAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Os guias dos servidores passam a documentos (tipo GUIDE, do agente, ligados ao servidor).
INSERT INTO "Doc" ("id", "userId", "title", "kind", "owner", "content", "summary", "tags", "required", "updatedBy", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'Guia do servidor ' || "name", 'GUIDE', 'AGENT', "guide",
       'O que se sabe do servidor ' || "name" || ', escrito depois de o estudar.', ARRAY['servidor']::TEXT[], false, 'migração',
       COALESCE("guideUpdatedAt", CURRENT_TIMESTAMP), COALESCE("guideUpdatedAt", CURRENT_TIMESTAMP)
FROM "ServerConnection"
WHERE "guide" IS NOT NULL AND btrim("guide") <> '';

INSERT INTO "DocLink" ("id", "docId", "type", "targetId", "label")
SELECT gen_random_uuid()::text, d."id", 'SERVER', s."id", s."name"
FROM "Doc" d
JOIN "ServerConnection" s ON s."userId" = d."userId" AND d."title" = 'Guia do servidor ' || s."name"
WHERE d."kind" = 'GUIDE' AND d."updatedBy" = 'migração';

ALTER TABLE "ServerConnection" DROP COLUMN "guide",
DROP COLUMN "guideUpdatedAt";

-- Os agentes das equipas que já existem passam a ler os documentos (e a propor mudanças);
-- o Jarvis e o Engenheiro de Infraestrutura também escrevem os deles; o Engenheiro trata
-- das atualizações.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_search', 'docs_read', 'docs_propose']::TEXT[], "updatedAt" = NOW()
WHERE NOT ('docs_read' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_write']::TEXT[], "updatedAt" = NOW()
WHERE "template" IN ('ceo', 'infra') AND NOT ('docs_write' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['updates_list', 'update_status', 'update_release_notes', 'update_known_issues', 'update_save_study', 'update_set_status', 'update_add_note', 'update_prepare']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('update_prepare' = ANY("tools"));

UPDATE "Agent"
SET "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), estuda e faz as atualizações das apps com a tua aprovação, corre comandos, escreve o guia de cada servidor e trata do AdGuard (DNS), do Forgejo (código e CI) e do Plane (projetos e tarefas).', "updatedAt" = NOW()
WHERE "template" = 'infra' AND "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor, trata do AdGuard (DNS e bloqueios da rede), do Forgejo (repositórios, issues, releases e CI) e do Plane (projetos e tarefas).';
