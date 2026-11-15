-- DropForeignKey
ALTER TABLE "ExerciseMedia" DROP CONSTRAINT "ExerciseMedia_typeId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingPlan" DROP CONSTRAINT "TrainingPlan_userId_fkey";

-- DropForeignKey
ALTER TABLE "Workout" DROP CONSTRAINT "Workout_planId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutExercise" DROP CONSTRAINT "WorkoutExercise_typeId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutExercise" DROP CONSTRAINT "WorkoutExercise_workoutId_fkey";

-- AlterTable
ALTER TABLE "ExerciseType" DROP COLUMN "equipment",
DROP COLUMN "group",
DROP COLUMN "holdSec",
DROP COLUMN "muscles",
DROP COLUMN "unit",
DROP COLUMN "weighted";

-- AlterTable
ALTER TABLE "Workout" DROP COLUMN "planId",
ADD COLUMN     "exercises" JSONB,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "volumeKg" DOUBLE PRECISION;

-- DropTable
DROP TABLE "ExerciseMedia";

-- DropTable
DROP TABLE "TrainingPlan";

-- DropTable
DROP TABLE "WorkoutExercise";

-- CreateTable
CREATE TABLE "OpenGymConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accountName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "runFrequency" "RunFrequency" NOT NULL DEFAULT 'EVERY_30_MINUTES',
    "lastRev" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCreated" INTEGER,
    "lastUpdated" INTEGER,
    "lastDeleted" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenGymConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenGymExercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyPart" TEXT,
    "target" TEXT,
    "equipment" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenGymExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenGymConnection_userId_key" ON "OpenGymConnection"("userId");

-- AddForeignKey
ALTER TABLE "OpenGymConnection" ADD CONSTRAINT "OpenGymConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Os exercícios e alongamentos saem do catálogo: ficam só os desportos. Um treino
-- que por acaso aponte para um deles passa a "other" antes de os apagar.
UPDATE "Workout" SET "typeId" = 'other'
WHERE "typeId" IN (SELECT "id" FROM "ExerciseType" WHERE "category" <> 'SPORT');
DELETE FROM "ExerciseType" WHERE "category" <> 'SPORT';

-- Sem a lista de exercícios, um treino manual sem duração fica vazio.
DELETE FROM "Workout" WHERE "source" = 'MANUAL' AND "durationSec" <= 0;
