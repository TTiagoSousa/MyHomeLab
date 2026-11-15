-- Os pares de antes não tinham grupo (só existiam em develop): saem. As tarefas ficam.
DELETE FROM "TodoSyncLink";

-- CreateEnum
CREATE TYPE "TodoSyncScope" AS ENUM ('ALL', 'LISTS');

-- AlterTable
ALTER TABLE "TodoSyncLink" ADD COLUMN     "groupId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TodoSyncGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "TodoSyncScope" NOT NULL DEFAULT 'ALL',
    "listNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoSyncGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoSyncGroup_userId_idx" ON "TodoSyncGroup"("userId");

-- CreateIndex
CREATE INDEX "TodoSyncLink_groupId_idx" ON "TodoSyncLink"("groupId");

-- AddForeignKey
ALTER TABLE "TodoSyncGroup" ADD CONSTRAINT "TodoSyncGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncLink" ADD CONSTRAINT "TodoSyncLink_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TodoSyncGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

