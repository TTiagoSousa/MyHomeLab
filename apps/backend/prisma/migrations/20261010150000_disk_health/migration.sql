-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'DISK_PROBLEM';
ALTER TYPE "NotificationKind" ADD VALUE 'DISK_WARNING';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "serverConnectionId" TEXT,
ADD COLUMN     "subject" TEXT;

-- CreateTable
CREATE TABLE "DiskReading" (
    "id" TEXT NOT NULL,
    "serverConnectionId" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "diskKey" TEXT NOT NULL,
    "devPath" TEXT NOT NULL,
    "model" TEXT,
    "serial" TEXT,
    "diskType" TEXT,
    "sizeBytes" BIGINT,
    "health" TEXT,
    "wearout" INTEGER,
    "temperature" INTEGER,
    "reallocated" INTEGER,
    "pending" INTEGER,
    "mediaErrors" INTEGER,
    "powerOnHours" INTEGER,
    "day" DATE NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiskReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiskReading_serverConnectionId_node_diskKey_day_key" ON "DiskReading"("serverConnectionId", "node", "diskKey", "day");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiskReading" ADD CONSTRAINT "DiskReading_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

