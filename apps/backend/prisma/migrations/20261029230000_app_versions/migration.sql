-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "appCheckedAt" TIMESTAMP(3),
ADD COLUMN     "appLatestUrl" TEXT,
ADD COLUMN     "appLatestVersion" TEXT,
ADD COLUMN     "appVersion" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "connectedAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

