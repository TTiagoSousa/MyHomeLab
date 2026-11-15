-- AlterEnum
ALTER TYPE "AppUpdateStatus" ADD VALUE 'LATER';

-- AlterEnum
ALTER TYPE "DocKind" ADD VALUE 'LOG';

-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "history" JSONB,
ADD COLUMN     "logDocId" TEXT,
ADD COLUMN     "manualSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reasonsAgainst" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reasonsFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recheckAt" TIMESTAMP(3),
ADD COLUMN     "sources" JSONB,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "updateAfter" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UpdateWorkflowSetting" ADD COLUMN     "boardModules" TEXT[] DEFAULT ARRAY['Servidor', 'Atualizações do servidor']::TEXT[];


-- As checklists de atualizar são das apps que correm nos servidores: o título e o texto dizem-no.
UPDATE "Doc"
SET "title" = 'Apps do servidor – antes de atualizar',
    "content" = replace("content", '# Antes de atualizar', '# Apps do servidor – antes de atualizar' || chr(10) || chr(10) || 'Para as apps que correm nos servidores (AdGuard, TREK, Plane, Home Assistant, Forgejo…), antes de as atualizar.'),
    "summary" = 'Os pontos a verificar antes de atualizar uma app do servidor, com a prova de cada um.',
    "updatedAt" = NOW()
WHERE "kind" = 'CHECKLIST' AND "title" = 'Antes de atualizar';

UPDATE "Doc"
SET "title" = 'Apps do servidor – depois de atualizar',
    "content" = replace("content", '# Depois de atualizar', '# Apps do servidor – depois de atualizar' || chr(10) || chr(10) || 'Para as apps que correm nos servidores, depois de as atualizar. Se falhar, volta-se ao snapshot.'),
    "summary" = 'O que confirmar depois de atualizar uma app do servidor; se falhar, volta-se ao snapshot.',
    "updatedAt" = NOW()
WHERE "kind" = 'CHECKLIST' AND "title" = 'Depois de atualizar';

-- Os agentes que escrevem documentos também deixam registos do que fazem.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_log']::TEXT[], "updatedAt" = NOW()
WHERE 'docs_write' = ANY("tools") AND NOT ('docs_log' = ANY("tools"));
