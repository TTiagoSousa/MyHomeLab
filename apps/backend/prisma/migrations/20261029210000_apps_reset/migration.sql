-- As integrações das apps saíram dos serviços vigiados; voltam uma a uma como
-- Apps ligadas. Os backups antigos eram dessas integrações: apagam-se (os ficheiros
-- já gravados ficam no destino). Os destinos ficam.
DELETE FROM "BackupRun";
DELETE FROM "BackupJob";

-- Alertas que só as integrações fechavam: ficam resolvidos.
UPDATE "Notification" SET "resolvedAt" = NOW()
WHERE "resolvedAt" IS NULL
  AND ("kind" IN ('APP_UPDATE', 'CERT_EXPIRED', 'CERT_EXPIRING', 'APP_PROBLEM', 'APP_WARNING', 'BACKUP_FAILED')
       OR ("kind" = 'DISK_WARNING' AND "monitorId" IS NOT NULL));

-- DropForeignKey
ALTER TABLE "AdguardFilterRefresh" DROP CONSTRAINT "AdguardFilterRefresh_monitorId_fkey";

-- DropForeignKey
ALTER TABLE "BackupJob" DROP CONSTRAINT "BackupJob_monitorId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceMonitor" DROP CONSTRAINT "ServiceMonitor_connectedAccountId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceMonitor" DROP CONSTRAINT "ServiceMonitor_coolifyMonitorId_fkey";

-- DropIndex
DROP INDEX "BackupJob_monitorId_idx";

-- AlterTable
ALTER TABLE "BackupDestination" ADD COLUMN     "accountId" TEXT,
ALTER COLUMN "url" DROP NOT NULL,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BackupJob" DROP COLUMN "monitorId",
ADD COLUMN     "accountId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ServiceMonitor" DROP COLUMN "app",
DROP COLUMN "appCheckedAt",
DROP COLUMN "appLatestVersion",
DROP COLUMN "appPassword",
DROP COLUMN "appPendingUpdates",
DROP COLUMN "appUsername",
DROP COLUMN "appVersion",
DROP COLUMN "certAlertDays",
DROP COLUMN "certAlertEnabled",
DROP COLUMN "connectedAccountId",
DROP COLUMN "coolifyMonitorId",
DROP COLUMN "coolifyResourceName",
DROP COLUMN "coolifyResourceType",
DROP COLUMN "coolifyResourceUuid";

-- DropTable
DROP TABLE "AdguardFilterRefresh";

-- DropEnum
DROP TYPE "AdguardRefreshSource";

-- DropEnum
DROP TYPE "MonitorApp";

-- CreateIndex
CREATE INDEX "BackupJob_accountId_idx" ON "BackupJob"("accountId");

-- AddForeignKey
ALTER TABLE "BackupDestination" ADD CONSTRAINT "BackupDestination_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

