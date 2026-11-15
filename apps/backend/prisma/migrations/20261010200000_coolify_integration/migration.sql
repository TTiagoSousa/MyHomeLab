-- AlterEnum
ALTER TYPE "MonitorApp" ADD VALUE 'COOLIFY';

-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "coolifyMonitorId" TEXT,
ADD COLUMN     "coolifyResourceName" TEXT,
ADD COLUMN     "coolifyResourceType" TEXT,
ADD COLUMN     "coolifyResourceUuid" TEXT;

-- AddForeignKey
ALTER TABLE "ServiceMonitor" ADD CONSTRAINT "ServiceMonitor_coolifyMonitorId_fkey" FOREIGN KEY ("coolifyMonitorId") REFERENCES "ServiceMonitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

