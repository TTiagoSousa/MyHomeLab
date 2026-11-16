-- Uma proposta de documento novo pode trazer as etiquetas e juntar outros documentos
-- (replaces): aprovada, os que juntou apagam-se.
ALTER TABLE "DocProposal" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DocProposal" ADD COLUMN "replaces" TEXT[] DEFAULT ARRAY[]::TEXT[];
