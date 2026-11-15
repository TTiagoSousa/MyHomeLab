-- AlterTable
ALTER TABLE "TaskSyncPair" DROP COLUMN "direction";

-- DropEnum
DROP TYPE "TaskSyncDirection";
