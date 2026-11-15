-- CreateTable
CREATE TABLE "HeartRateDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "avgBpm" INTEGER NOT NULL,
    "minBpm" INTEGER NOT NULL,
    "maxBpm" INTEGER NOT NULL,
    "minAt" INTEGER,
    "maxAt" INTEGER,
    "restingBpm" INTEGER,
    "avgHrv" INTEGER,
    "samples" INTEGER NOT NULL,
    "zones" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "hrvPoints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeartRateDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeartRateDay_userId_day_idx" ON "HeartRateDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "HeartRateDay_userId_source_day_key" ON "HeartRateDay"("userId", "source", "day");

-- AddForeignKey
ALTER TABLE "HeartRateDay" ADD CONSTRAINT "HeartRateDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

