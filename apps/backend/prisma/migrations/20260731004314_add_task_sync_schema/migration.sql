-- CreateEnum
CREATE TYPE "TaskPlatform" AS ENUM ('NEXTCLOUD', 'GOOGLE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NEEDS_ACTION', 'IN_PROCESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskSyncDirection" AS ENUM ('NEXTCLOUD_TO_GOOGLE', 'GOOGLE_TO_NEXTCLOUD', 'BIDIRECTIONAL');

-- RenameEnum (preserves existing data instead of dropping/recreating the column)
ALTER TYPE "EmailProvider" RENAME TO "ConnectionProvider";
ALTER TYPE "ConnectionProvider" ADD VALUE 'NEXTCLOUD';

-- DropIndex
DROP INDEX "ConnectedAccount_userId_emailAddress_key";

-- AlterTable
ALTER TABLE "ConnectedAccount"
  ADD COLUMN "caldavUrl" TEXT,
  ADD COLUMN "caldavUsername" TEXT,
  ADD COLUMN "caldavPassword" TEXT,
  ALTER COLUMN "emailAddress" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TaskSyncPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nextcloudAccountId" TEXT NOT NULL,
    "nextcloudListId" TEXT NOT NULL,
    "googleAccountId" TEXT NOT NULL,
    "googleListId" TEXT NOT NULL,
    "direction" "TaskSyncDirection" NOT NULL DEFAULT 'NEXTCLOUD_TO_GOOGLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "runFrequency" "RunFrequency" NOT NULL DEFAULT 'HOURLY',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSyncPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "syncPairId" TEXT NOT NULL,
    "syncGroupId" TEXT NOT NULL,
    "platform" "TaskPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NEEDS_ACTION',
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "percentComplete" INTEGER,
    "priority" INTEGER,
    "location" TEXT,
    "url" TEXT,
    "tags" TEXT[],
    "externalUpdatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_syncGroupId_idx" ON "Task"("syncGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_syncPairId_platform_externalId_key" ON "Task"("syncPairId", "platform", "externalId");

-- AddForeignKey
ALTER TABLE "TaskSyncPair" ADD CONSTRAINT "TaskSyncPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSyncPair" ADD CONSTRAINT "TaskSyncPair_nextcloudAccountId_fkey" FOREIGN KEY ("nextcloudAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSyncPair" ADD CONSTRAINT "TaskSyncPair_googleAccountId_fkey" FOREIGN KEY ("googleAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_syncPairId_fkey" FOREIGN KEY ("syncPairId") REFERENCES "TaskSyncPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
