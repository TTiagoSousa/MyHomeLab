-- DropForeignKey
ALTER TABLE "DailyActivity" DROP CONSTRAINT "DailyActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "DailyVitals" DROP CONSTRAINT "DailyVitals_userId_fkey";

-- DropForeignKey
ALTER TABLE "HealthImport" DROP CONSTRAINT "HealthImport_userId_fkey";

-- DropForeignKey
ALTER TABLE "HeartRateBucket" DROP CONSTRAINT "HeartRateBucket_vitalsId_fkey";

-- DropForeignKey
ALTER TABLE "SleepSession" DROP CONSTRAINT "SleepSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "SleepStageSegment" DROP CONSTRAINT "SleepStageSegment_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Sport" DROP CONSTRAINT "Sport_userId_fkey";

-- DropForeignKey
ALTER TABLE "SportSourceMapping" DROP CONSTRAINT "SportSourceMapping_sportId_fkey";

-- DropForeignKey
ALTER TABLE "SportSourceMapping" DROP CONSTRAINT "SportSourceMapping_userId_fkey";

-- DropForeignKey
ALTER TABLE "StepBucket" DROP CONSTRAINT "StepBucket_activityId_fkey";

-- DropForeignKey
ALTER TABLE "Workout" DROP CONSTRAINT "Workout_sportId_fkey";

-- DropForeignKey
ALTER TABLE "Workout" DROP CONSTRAINT "Workout_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutTrack" DROP CONSTRAINT "WorkoutTrack_workoutId_fkey";

-- DropTable
DROP TABLE "DailyActivity";

-- DropTable
DROP TABLE "DailyVitals";

-- DropTable
DROP TABLE "HealthImport";

-- DropTable
DROP TABLE "HeartRateBucket";

-- DropTable
DROP TABLE "SleepSession";

-- DropTable
DROP TABLE "SleepStageSegment";

-- DropTable
DROP TABLE "Sport";

-- DropTable
DROP TABLE "SportSourceMapping";

-- DropTable
DROP TABLE "StepBucket";

-- DropTable
DROP TABLE "Workout";

-- DropTable
DROP TABLE "WorkoutTrack";

-- DropEnum
DROP TYPE "HealthImportKind";

-- DropEnum
DROP TYPE "HealthSource";

-- DropEnum
DROP TYPE "SleepStage";

