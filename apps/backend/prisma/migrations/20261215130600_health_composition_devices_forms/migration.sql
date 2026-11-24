-- AlterEnum
ALTER TYPE "TodayShortcutKind" ADD VALUE 'HEALTH_FORM';
ALTER TYPE "TodayShortcutKind" ADD VALUE 'INTAKES';

-- AlterTable
ALTER TABLE "HealthProfile" ADD COLUMN     "averageTabs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TodayShortcut" ADD COLUMN     "formId" TEXT;

-- AlterTable
ALTER TABLE "WeightEntry" ADD COLUMN     "bmrKcal" DOUBLE PRECISION,
ADD COLUMN     "bodyFatPct" DOUBLE PRECISION,
ADD COLUMN     "boneKg" DOUBLE PRECISION,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "leanKg" DOUBLE PRECISION,
ADD COLUMN     "muscleKg" DOUBLE PRECISION,
ADD COLUMN     "proteinPct" DOUBLE PRECISION,
ADD COLUMN     "skeletalMusclePct" DOUBLE PRECISION,
ADD COLUMN     "subcutaneousFatPct" DOUBLE PRECISION,
ADD COLUMN     "visceralFat" DOUBLE PRECISION,
ADD COLUMN     "waterPct" DOUBLE PRECISION,
ALTER COLUMN "weightKg" DROP NOT NULL;

-- A gordura e o músculo passam das medidas do corpo para a pesagem desse dia
-- (a mais recente); os dias sem pesagem ganham uma só com esses dois valores.
UPDATE "WeightEntry" w SET
  "bodyFatPct" = COALESCE(w."bodyFatPct", b."bodyFatPct"),
  "muscleKg" = COALESCE(w."muscleKg", b."muscleKg")
FROM "BodyMeasurement" b
WHERE (b."bodyFatPct" IS NOT NULL OR b."muscleKg" IS NOT NULL)
  AND w."id" = (
    SELECT w2."id" FROM "WeightEntry" w2
    WHERE w2."userId" = b."userId" AND w2."day" = b."day"
    ORDER BY w2."measuredAt" DESC
    LIMIT 1
  );

INSERT INTO "WeightEntry" ("id", "userId", "measuredAt", "day", "bodyFatPct", "muscleKg")
SELECT gen_random_uuid()::text, b."userId", b."day" + INTERVAL '12 hours', b."day", b."bodyFatPct", b."muscleKg"
FROM "BodyMeasurement" b
WHERE (b."bodyFatPct" IS NOT NULL OR b."muscleKg" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "WeightEntry" w WHERE w."userId" = b."userId" AND w."day" = b."day"
  );

-- AlterTable
ALTER TABLE "BodyMeasurement" DROP COLUMN "bodyFatPct",
DROP COLUMN "muscleKg";

-- As linhas que só tinham gordura ou músculo ficaram vazias
DELETE FROM "BodyMeasurement"
WHERE "waistCm" IS NULL AND "chestCm" IS NULL AND "armCm" IS NULL
  AND "thighCm" IS NULL AND "hipsCm" IS NULL AND "neckCm" IS NULL
  AND "notes" IS NULL;

-- CreateTable
CREATE TABLE "MeasurementDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthForm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementDevice_userId_name_key" ON "MeasurementDevice"("userId", "name");

-- CreateIndex
CREATE INDEX "HealthForm_userId_position_idx" ON "HealthForm"("userId", "position");

-- CreateIndex
CREATE INDEX "TodayShortcut_formId_idx" ON "TodayShortcut"("formId");

-- CreateIndex
CREATE INDEX "WeightEntry_deviceId_idx" ON "WeightEntry"("deviceId");

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MeasurementDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementDevice" ADD CONSTRAINT "MeasurementDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthForm" ADD CONSTRAINT "HealthForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodayShortcut" ADD CONSTRAINT "TodayShortcut_formId_fkey" FOREIGN KEY ("formId") REFERENCES "HealthForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
