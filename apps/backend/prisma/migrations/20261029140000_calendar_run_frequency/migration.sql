-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "calendarRunFrequency" "RunFrequency" NOT NULL DEFAULT 'HOURLY';

-- As contas que já existiam continuam a copiar os calendários ao ritmo das tarefas.
UPDATE "ConnectedAccount" SET "calendarRunFrequency" = "runFrequency" WHERE "provider" = 'NEXTCLOUD';
