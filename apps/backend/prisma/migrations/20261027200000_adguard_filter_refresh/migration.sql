-- CreateEnum
CREATE TYPE "AdguardRefreshSource" AS ENUM ('MANUAL', 'AUTOMATIC', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AdguardFilterRefresh" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "source" "AdguardRefreshSource" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "updated" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdguardFilterRefresh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdguardFilterRefresh_monitorId_at_idx" ON "AdguardFilterRefresh"("monitorId", "at");

-- AddForeignKey
ALTER TABLE "AdguardFilterRefresh" ADD CONSTRAINT "AdguardFilterRefresh_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ServiceMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

