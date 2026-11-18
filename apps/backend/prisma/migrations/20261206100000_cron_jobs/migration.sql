-- Os cron jobs das apps (tarefas em código, sem IA).
-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastOk" BOOLEAN,
    "lastCount" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJob_nextRunAt_idx" ON "CronJob"("nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "CronJob_accountId_key_key" ON "CronJob"("accountId", "key");

-- AddForeignKey
ALTER TABLE "CronJob" ADD CONSTRAINT "CronJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronJob" ADD CONSTRAINT "CronJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
