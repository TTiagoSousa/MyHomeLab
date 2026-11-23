-- CreateEnum
CREATE TYPE "TodayShortcutKind" AS ENUM ('APP', 'EMAIL_RULES', 'LINK');

-- CreateTable
CREATE TABLE "TodayShortcut" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TodayShortcutKind" NOT NULL,
    "accountId" TEXT,
    "label" TEXT,
    "url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodayShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherLocation" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherLocation_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "TodayShortcut_userId_position_idx" ON "TodayShortcut"("userId", "position");

-- CreateIndex
CREATE INDEX "TodayShortcut_accountId_idx" ON "TodayShortcut"("accountId");

-- AddForeignKey
ALTER TABLE "TodayShortcut" ADD CONSTRAINT "TodayShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodayShortcut" ADD CONSTRAINT "TodayShortcut_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherLocation" ADD CONSTRAINT "WeatherLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
