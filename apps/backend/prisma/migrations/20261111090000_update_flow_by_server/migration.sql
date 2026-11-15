-- Atualizações: o ponto saltado por pedido direto, a instalação sozinha na janela
-- (Ready to update) e o projeto das atualizações ligado a um servidor.

-- AlterEnum
ALTER TYPE "UpdateCheckState" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "installStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "serverConnectionId" TEXT;

-- AlterTable
ALTER TABLE "UpdateWorkflowSetting" ADD COLUMN     "autoInstall" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "installFrom" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "installTo" INTEGER NOT NULL DEFAULT 7;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O projeto das atualizações passa a ser o do servidor ("Servidor - 1"), ligado ao
-- servidor do utilizador quando só tem um.
UPDATE "Project" p
SET "name" = 'Servidor - 1',
    "serverConnectionId" = (
      SELECT s."id" FROM "ServerConnection" s WHERE s."userId" = p."userId"
      AND (SELECT count(*) FROM "ServerConnection" c WHERE c."userId" = p."userId") = 1
    )
WHERE p."kind" = 'UPDATES' AND p."name" = 'Atualizações';

UPDATE "DocLink" l
SET "label" = 'Servidor - 1'
FROM "Project" p
WHERE l."type" = 'PROJECT' AND l."targetId" = p."id" AND p."kind" = 'UPDATES' AND p."name" = 'Servidor - 1';

-- As regras passam a ser por app: as checklists gerais de antes e depois saem.
DELETE FROM "Doc"
WHERE "kind" = 'CHECKLIST'
  AND "title" IN ('Apps do servidor – antes de atualizar', 'Apps do servidor – depois de atualizar');
