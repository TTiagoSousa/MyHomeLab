
-- CreateEnum
CREATE TYPE "BackupDestinationKind" AS ENUM ('NEXTCLOUD');

-- CreateEnum
CREATE TYPE "BackupRetention" AS ENUM ('REPLACE', 'KEEP_LAST', 'KEEP_ALL');

-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('SUCCESS', 'ERROR');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'BACKUP_FAILED';

-- CreateTable
CREATE TABLE "BackupDestination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BackupDestinationKind" NOT NULL DEFAULT 'NEXTCLOUD',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'backups',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "runFrequency" "RunFrequency" NOT NULL DEFAULT 'DAILY',
    "retention" "BackupRetention" NOT NULL DEFAULT 'KEEP_LAST',
    "keepCount" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "BackupRunStatus" NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupDestination_userId_idx" ON "BackupDestination"("userId");

-- CreateIndex
CREATE INDEX "BackupJob_userId_idx" ON "BackupJob"("userId");

-- CreateIndex
CREATE INDEX "BackupJob_monitorId_idx" ON "BackupJob"("monitorId");

-- CreateIndex
CREATE INDEX "BackupRun_jobId_startedAt_idx" ON "BackupRun"("jobId", "startedAt");

-- AddForeignKey
ALTER TABLE "BackupDestination" ADD CONSTRAINT "BackupDestination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ServiceMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "BackupDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackupJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
