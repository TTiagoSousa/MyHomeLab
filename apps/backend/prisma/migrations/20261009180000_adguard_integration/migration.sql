-- AlterEnum
ALTER TYPE "MonitorApp" ADD VALUE 'ADGUARD';
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'APP_UPDATE';
-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "appCheckedAt" TIMESTAMP(3),
ADD COLUMN     "appLatestVersion" TEXT,
ADD COLUMN     "appPassword" TEXT,
ADD COLUMN     "appUsername" TEXT,
ADD COLUMN     "appVersion" TEXT;
