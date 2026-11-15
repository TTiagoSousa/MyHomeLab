-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'GOOGLE_TASKS';

-- CreateTable
CREATE TABLE "TodoSyncSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoSyncSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoSyncLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "remoteListId" TEXT NOT NULL,
    "remoteListName" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoSyncLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoSyncItem" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "todoId" TEXT,
    "remoteId" TEXT NOT NULL,
    "localUpdatedAt" TIMESTAMP(3) NOT NULL,
    "remoteUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoSyncItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodoSyncSetting_userId_key" ON "TodoSyncSetting"("userId");

-- CreateIndex
CREATE INDEX "TodoSyncLink_userId_idx" ON "TodoSyncLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoSyncLink_listId_accountId_key" ON "TodoSyncLink"("listId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoSyncLink_accountId_remoteListId_key" ON "TodoSyncLink"("accountId", "remoteListId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoSyncItem_linkId_remoteId_key" ON "TodoSyncItem"("linkId", "remoteId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoSyncItem_linkId_todoId_key" ON "TodoSyncItem"("linkId", "todoId");

-- AddForeignKey
ALTER TABLE "TodoSyncSetting" ADD CONSTRAINT "TodoSyncSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncLink" ADD CONSTRAINT "TodoSyncLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncLink" ADD CONSTRAINT "TodoSyncLink_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TodoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncLink" ADD CONSTRAINT "TodoSyncLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncItem" ADD CONSTRAINT "TodoSyncItem_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TodoSyncLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSyncItem" ADD CONSTRAINT "TodoSyncItem_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

