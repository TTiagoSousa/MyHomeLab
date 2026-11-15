-- AlterTable
ALTER TABLE "ServiceMonitor" ADD COLUMN     "certAlertDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "certAlertEnabled" BOOLEAN NOT NULL DEFAULT true;

