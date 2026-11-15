-- AlterEnum
ALTER TYPE "MonitorApp" ADD VALUE 'HOME_ASSISTANT';
-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "appPendingUpdates" INTEGER;
