-- AlterTable
ALTER TABLE "ExerciseType" ADD COLUMN     "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "holdSec" INTEGER,
ADD COLUMN     "images" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "muscles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "IntakeEntry" ADD COLUMN     "alcoholG" DOUBLE PRECISION,
ADD COLUMN     "caffeineMg" DOUBLE PRECISION,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "presetId" TEXT,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "volumeMl" INTEGER;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "caloriesEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "difficulty" INTEGER,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "difficulty" INTEGER,
ADD COLUMN     "distanceM" INTEGER,
ADD COLUMN     "restSec" INTEGER;

-- CreateTable
CREATE TABLE "IntakeItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "volumeMl" INTEGER,
    "caffeineMg" DOUBLE PRECISION,
    "alcoholG" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSettings" (
    "userId" TEXT NOT NULL,
    "caffeineLimitMg" INTEGER,
    "alcoholLimitWeek" DOUBLE PRECISION,
    "hiddenPresets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT NOT NULL DEFAULT 'strength',
    "notes" TEXT,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "exercises" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntakeItem_userId_idx" ON "IntakeItem"("userId");

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_idx" ON "TrainingPlan"("userId");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeItem" ADD CONSTRAINT "IntakeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSettings" ADD CONSTRAINT "IntakeSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Os planos por dia da semana passam a planos com nome, sugeridos nesse dia
INSERT INTO "TrainingPlan" ("id", "userId", "name", "weekdays", "exercises", "position", "updatedAt")
SELECT "id", "userId", "name", ARRAY["weekday"], "exercises", "weekday", "updatedAt" FROM "TrainingPlanDay";

ALTER TABLE "TrainingPlanDay" DROP CONSTRAINT "TrainingPlanDay_userId_fkey";
DROP TABLE "TrainingPlanDay";

-- Os consumos antigos guardavam a cafeína (mg) e o álcool (bebidas padrão) em amount
UPDATE "IntakeEntry" SET "caffeineMg" = "amount", "amount" = NULL, "unit" = NULL WHERE "kind" = 'CAFFEINE';
UPDATE "IntakeEntry" SET "alcoholG" = COALESCE("amount", 1) * 10, "amount" = NULL, "unit" = NULL WHERE "kind" = 'ALCOHOL';

-- Um tipo de treino só de alongamentos
INSERT INTO "ExerciseType" ("id", "category", "unit", "huaweiCodes", "position") VALUES
    ('stretching', 'SPORT', NULL, '{}', 18)
ON CONFLICT ("id") DO NOTHING;
