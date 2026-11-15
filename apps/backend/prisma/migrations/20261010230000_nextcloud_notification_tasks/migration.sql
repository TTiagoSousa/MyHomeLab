-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "taskUrl" TEXT;

-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "connectedAccountId" TEXT;

-- CreateTable
CREATE TABLE "NotificationTaskSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "listUrl" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTaskSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTaskSetting_userId_key" ON "NotificationTaskSetting"("userId");

-- AddForeignKey
ALTER TABLE "ServiceMonitor" ADD CONSTRAINT "ServiceMonitor_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTaskSetting" ADD CONSTRAINT "NotificationTaskSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTaskSetting" ADD CONSTRAINT "NotificationTaskSetting_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

