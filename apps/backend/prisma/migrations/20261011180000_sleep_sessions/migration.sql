-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "isNap" BOOLEAN NOT NULL DEFAULT false,
    "night" DATE NOT NULL,
    "timeZone" TEXT,
    "bedAt" TIMESTAMP(3),
    "asleepAt" TIMESTAMP(3) NOT NULL,
    "wakeAt" TIMESTAMP(3) NOT NULL,
    "riseAt" TIMESTAMP(3),
    "asleepMin" INTEGER NOT NULL,
    "deepMin" INTEGER NOT NULL DEFAULT 0,
    "lightMin" INTEGER NOT NULL DEFAULT 0,
    "remMin" INTEGER NOT NULL DEFAULT 0,
    "awakeMin" INTEGER NOT NULL DEFAULT 0,
    "efficiency" INTEGER,
    "latencyMin" INTEGER,
    "deepContinuity" INTEGER,
    "wakeCount" INTEGER,
    "turnOverCount" INTEGER,
    "snoreFreq" INTEGER,
    "rdi" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "avgHrv" INTEGER,
    "avgBreathRate" DOUBLE PRECISION,
    "avgSpo2" INTEGER,
    "minSpo2" INTEGER,
    "baseline" JSONB,
    "stages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SleepSession_userId_night_idx" ON "SleepSession"("userId", "night");

-- CreateIndex
CREATE UNIQUE INDEX "SleepSession_userId_source_externalId_key" ON "SleepSession"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

