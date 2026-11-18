-- O aviso de disco quase cheio: os cron jobs dos servidores e os avisos (DiskAlert).
-- CreateEnum
CREATE TYPE "DiskAlertStatus" AS ENUM ('OPEN', 'STUDY', 'WAITING', 'FIXING', 'VERIFYING', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "CronJob" ADD COLUMN     "lastDetail" JSONB,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "serverConnectionId" TEXT,
ALTER COLUMN "accountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DiskAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverConnectionId" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "guestKind" TEXT NOT NULL,
    "vmid" INTEGER NOT NULL,
    "guestName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" "DiskAlertStatus" NOT NULL DEFAULT 'OPEN',
    "usedBytes" DOUBLE PRECISION NOT NULL,
    "totalBytes" DOUBLE PRECISION NOT NULL,
    "firstPercent" DOUBLE PRECISION NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "boardTaskId" TEXT,
    "agentKey" TEXT,
    "study" TEXT,
    "question" TEXT,
    "askedAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiskAlert_serverConnectionId_status_idx" ON "DiskAlert"("serverConnectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CronJob_serverConnectionId_key_key" ON "CronJob"("serverConnectionId", "key");

-- AddForeignKey
ALTER TABLE "CronJob" ADD CONSTRAINT "CronJob_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiskAlert" ADD CONSTRAINT "DiskAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiskAlert" ADD CONSTRAINT "DiskAlert_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já tem o pve_set_resources (o Operador Proxmox) recebe as ferramentas dos avisos de disco.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['disk_alert_get', 'disk_alert_save_study', 'disk_alert_grow', 'disk_alert_ask', 'disk_alert_done']::TEXT[], "updatedAt" = NOW()
WHERE 'pve_set_resources' = ANY("tools") AND NOT ('disk_alert_get' = ANY("tools"));
