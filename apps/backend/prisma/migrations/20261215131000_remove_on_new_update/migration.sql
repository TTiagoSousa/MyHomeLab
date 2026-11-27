-- Os disparos "quando aparece uma atualização nova" deixam de existir: as atualizações entram
-- no quadro pelo cron job de cada app. Apagam-se antes de mudar o enum (as execuções vão junto).
DELETE FROM "AgentSchedule" WHERE "repeat" = 'ON_NEW_UPDATE';

-- AlterEnum
BEGIN;
CREATE TYPE "AgentScheduleRepeat_new" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');
ALTER TABLE "public"."AgentSchedule" ALTER COLUMN "repeat" DROP DEFAULT;
ALTER TABLE "AgentSchedule" ALTER COLUMN "repeat" TYPE "AgentScheduleRepeat_new" USING ("repeat"::text::"AgentScheduleRepeat_new");
ALTER TYPE "AgentScheduleRepeat" RENAME TO "AgentScheduleRepeat_old";
ALTER TYPE "AgentScheduleRepeat_new" RENAME TO "AgentScheduleRepeat";
DROP TYPE "public"."AgentScheduleRepeat_old";
ALTER TABLE "AgentSchedule" ALTER COLUMN "repeat" SET DEFAULT 'ONCE';
COMMIT;

-- AlterTable
ALTER TABLE "AppUpdate" DROP COLUMN "announcedAt";
