-- Os anexos das tarefas ficam na base de dados (entram nos backups).
-- AlterTable
ALTER TABLE "BoardTaskAttachment" DROP COLUMN "path",
ADD COLUMN     "data" BYTEA NOT NULL;

