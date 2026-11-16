-- Os documentos passam a três tipos: Regras (o que se pode e como se faz), Mapa (o que
-- existe, mantido pelo agente) e Registo (o que se fez). Checklist, Aprendizagens, Notas
-- e Outro passam a Regras; Guia passa a Mapa. Os tipos criados pelo utilizador saem.
ALTER TYPE "DocKind" RENAME TO "DocKind_old";
CREATE TYPE "DocKind" AS ENUM ('RULES', 'MAP', 'LOG');

ALTER TABLE "Doc" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Doc" ALTER COLUMN "kind" TYPE "DocKind" USING (
  CASE "kind"::text WHEN 'GUIDE' THEN 'MAP' WHEN 'LOG' THEN 'LOG' ELSE 'RULES' END
)::"DocKind";
ALTER TABLE "Doc" ALTER COLUMN "kind" SET DEFAULT 'RULES';

ALTER TABLE "DocProposal" ALTER COLUMN "kind" TYPE "DocKind" USING (
  CASE WHEN "kind" IS NULL THEN NULL WHEN "kind"::text = 'GUIDE' THEN 'MAP' WHEN "kind"::text = 'LOG' THEN 'LOG' ELSE 'RULES' END
)::"DocKind";

DROP TYPE "DocKind_old";

ALTER TABLE "Doc" DROP CONSTRAINT IF EXISTS "Doc_typeId_fkey";
ALTER TABLE "Doc" DROP COLUMN IF EXISTS "typeId";
DROP TABLE IF EXISTS "DocType";
