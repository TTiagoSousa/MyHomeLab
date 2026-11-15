-- AlterTable
ALTER TABLE "AgentSchedule" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Os "rever mais tarde" das atualizações ficam com a etiqueta delas.
UPDATE "AgentSchedule" SET "tags" = ARRAY['atualizações']::TEXT[] WHERE "updateId" IS NOT NULL;
