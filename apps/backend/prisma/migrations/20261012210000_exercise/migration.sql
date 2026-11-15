-- CreateTable
CREATE TABLE "ActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "steps" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "calories" INTEGER NOT NULL,
    "activeMinutes" INTEGER NOT NULL,
    "hourly" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sportType" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "distanceM" INTEGER,
    "calories" INTEGER,
    "steps" INTEGER,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "avgPace" DOUBLE PRECISION,
    "bestPace" DOUBLE PRECISION,
    "avgCadence" INTEGER,
    "ascentM" DOUBLE PRECISION,
    "descentM" DOUBLE PRECISION,
    "trainingEffect" DOUBLE PRECISION,
    "recoveryMin" INTEGER,
    "heartZones" JSONB,
    "heartRate" JSONB,
    "cadence" JSONB,
    "altitude" JSONB,
    "route" JSONB,
    "splits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityDay_userId_day_idx" ON "ActivityDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityDay_userId_source_day_key" ON "ActivityDay"("userId", "source", "day");

-- CreateIndex
CREATE INDEX "Workout_userId_startAt_idx" ON "Workout"("userId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_source_externalId_key" ON "Workout"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

