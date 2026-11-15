-- CreateEnum
CREATE TYPE "MonitorKind" AS ENUM ('HTTP', 'TCP');
-- CreateEnum
CREATE TYPE "MonitorApp" AS ENUM ('GENERIC');
-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('UNKNOWN', 'UP', 'DOWN');
-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SERVICE_DOWN', 'MACHINE_MISSING');
-- CreateTable
CREATE TABLE "ServiceMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MonitorKind" NOT NULL DEFAULT 'HTTP',
    "app" "MonitorApp" NOT NULL DEFAULT 'GENERIC',
    "target" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "serverConnectionId" TEXT,
    "guestVmid" INTEGER,
    "guestName" TEXT,
    "status" "MonitorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "lastLatencyMs" INTEGER,
    "lastError" TEXT,
    "guestMissing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceMonitor_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "monitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ServiceMonitor_userId_idx" ON "ServiceMonitor"("userId");
-- CreateIndex
CREATE INDEX "Notification_userId_resolvedAt_idx" ON "Notification"("userId", "resolvedAt");
-- AddForeignKey
ALTER TABLE "ServiceMonitor" ADD CONSTRAINT "ServiceMonitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ServiceMonitor" ADD CONSTRAINT "ServiceMonitor_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ServiceMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
