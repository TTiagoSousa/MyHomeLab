-- Vários links por tarefa: o link que havia passa para a lista.
ALTER TABLE "Todo" ADD COLUMN "links" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Todo" SET "links" = ARRAY["link"] WHERE "link" IS NOT NULL;
ALTER TABLE "Todo" DROP COLUMN "link";
