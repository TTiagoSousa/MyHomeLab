-- CreateTable
CREATE TABLE "CalendarSyncPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nextcloudAccountId" TEXT NOT NULL,
    "nextcloudCalendarUrl" TEXT NOT NULL,
    "nextcloudCalendarName" TEXT,
    "googleAccountId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "googleCalendarName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSyncPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSyncEvent" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "etag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "time" TEXT NOT NULL DEFAULT '08:00',
    "weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[],
    "sections" TEXT[] DEFAULT ARRAY['emails', 'tasks', 'calendar', 'training', 'sleep', 'servers']::TEXT[],
    "emailAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sendTelegram" BOOLEAN NOT NULL DEFAULT true,
    "sendChat" BOOLEAN NOT NULL DEFAULT true,
    "lastSentDay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarSyncPair_userId_idx" ON "CalendarSyncPair"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSyncEvent_pairId_uid_key" ON "CalendarSyncEvent"("pairId", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingSetting_userId_key" ON "BriefingSetting"("userId");

-- AddForeignKey
ALTER TABLE "CalendarSyncPair" ADD CONSTRAINT "CalendarSyncPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncPair" ADD CONSTRAINT "CalendarSyncPair_nextcloudAccountId_fkey" FOREIGN KEY ("nextcloudAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncPair" ADD CONSTRAINT "CalendarSyncPair_googleAccountId_fkey" FOREIGN KEY ("googleAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncEvent" ADD CONSTRAINT "CalendarSyncEvent_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "CalendarSyncPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingSetting" ADD CONSTRAINT "BriefingSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

