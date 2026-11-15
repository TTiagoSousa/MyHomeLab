-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "downTaskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMonitor_accountId_key" ON "ServiceMonitor"("accountId");

-- AddForeignKey
ALTER TABLE "ServiceMonitor" ADD CONSTRAINT "ServiceMonitor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

