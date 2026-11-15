-- CreateEnum
CREATE TYPE "HealthSource" AS ENUM ('HUAWEI', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SleepStage" AS ENUM ('DEEP', 'LIGHT', 'REM', 'AWAKE');

-- CreateEnum
CREATE TYPE "HealthImportKind" AS ENUM ('SLEEP', 'STEPS', 'WORKOUTS', 'VITALS');

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportSourceMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "externalCode" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportSourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "distanceM" INTEGER,
    "calories" INTEGER,
    "steps" INTEGER,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "minHr" INTEGER,
    "avgPaceSecKm" INTEGER,
    "ascentM" INTEGER,
    "descentM" INTEGER,
    "hasTrack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTrack" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "night" DATE NOT NULL,
    "isNap" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "totalMin" INTEGER NOT NULL,
    "deepMin" INTEGER NOT NULL,
    "lightMin" INTEGER NOT NULL,
    "remMin" INTEGER NOT NULL,
    "awakeMin" INTEGER NOT NULL,
    "awakenings" INTEGER NOT NULL,
    "apneaLevel" INTEGER,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepStageSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" "SleepStage" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepStageSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "day" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "calories" INTEGER NOT NULL,
    "activeMin" INTEGER NOT NULL,
    "briskMin" INTEGER NOT NULL,
    "stepGoal" INTEGER,
    "goalMet" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepBucket" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,

    CONSTRAINT "StepBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyVitals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "day" DATE NOT NULL,
    "restingHr" INTEGER,
    "hrvRmssd" INTEGER,
    "spo2Avg" DOUBLE PRECISION,
    "spo2Min" INTEGER,
    "stressAvg" INTEGER,
    "stressMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyVitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthSource" NOT NULL,
    "kind" "HealthImportKind" NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "recordsImported" INTEGER NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sport_userId_name_key" ON "Sport"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SportSourceMapping_userId_source_externalCode_key" ON "SportSourceMapping"("userId", "source", "externalCode");

-- CreateIndex
CREATE INDEX "Workout_userId_startedAt_idx" ON "Workout"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Workout_userId_sportId_idx" ON "Workout"("userId", "sportId");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_source_externalId_key" ON "Workout"("userId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTrack_workoutId_key" ON "WorkoutTrack"("workoutId");

-- CreateIndex
CREATE INDEX "SleepSession_userId_night_idx" ON "SleepSession"("userId", "night");

-- CreateIndex
CREATE UNIQUE INDEX "SleepSession_userId_startedAt_key" ON "SleepSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SleepStageSegment_sessionId_startedAt_idx" ON "SleepStageSegment"("sessionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_day_key" ON "DailyActivity"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StepBucket_activityId_startedAt_key" ON "StepBucket"("activityId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyVitals_userId_day_key" ON "DailyVitals"("userId", "day");

-- CreateIndex
CREATE INDEX "HealthImport_userId_createdAt_idx" ON "HealthImport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Sport" ADD CONSTRAINT "Sport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportSourceMapping" ADD CONSTRAINT "SportSourceMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportSourceMapping" ADD CONSTRAINT "SportSourceMapping_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTrack" ADD CONSTRAINT "WorkoutTrack_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepStageSegment" ADD CONSTRAINT "SleepStageSegment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SleepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepBucket" ADD CONSTRAINT "StepBucket_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "DailyActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyVitals" ADD CONSTRAINT "DailyVitals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthImport" ADD CONSTRAINT "HealthImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
