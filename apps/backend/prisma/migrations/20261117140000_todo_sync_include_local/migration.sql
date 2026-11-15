-- AlterTable
ALTER TABLE "TodoList" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TodoSyncGroup" ADD COLUMN     "includeLocal" BOOLEAN NOT NULL DEFAULT true;

