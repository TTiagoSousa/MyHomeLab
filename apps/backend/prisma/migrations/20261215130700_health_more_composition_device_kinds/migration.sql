-- CreateEnum
CREATE TYPE "MeasurementDeviceKind" AS ENUM ('SCALE', 'BLOOD_PRESSURE', 'GLUCOMETER', 'THERMOMETER', 'OXIMETER', 'OTHER');

-- CreateEnum
CREATE TYPE "HealthFormLayout" AS ENUM ('GRID', 'LIST');

-- AlterTable
ALTER TABLE "HealthForm" ADD COLUMN     "layout" "HealthFormLayout" NOT NULL DEFAULT 'GRID';

-- AlterTable
ALTER TABLE "MeasurementDevice" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "kind" "MeasurementDeviceKind" NOT NULL DEFAULT 'SCALE',
ADD COLUMN     "model" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "VitalReading" ADD COLUMN     "deviceId" TEXT;

-- AlterTable
ALTER TABLE "WeightEntry" ADD COLUMN     "bmi" DOUBLE PRECISION,
ADD COLUMN     "bonePct" DOUBLE PRECISION,
ADD COLUMN     "fatMassKg" DOUBLE PRECISION,
ADD COLUMN     "musclePct" DOUBLE PRECISION,
ADD COLUMN     "proteinKg" DOUBLE PRECISION,
ADD COLUMN     "skeletalMuscleKg" DOUBLE PRECISION,
ADD COLUMN     "waterKg" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "VitalReading_deviceId_idx" ON "VitalReading"("deviceId");

-- AddForeignKey
ALTER TABLE "VitalReading" ADD CONSTRAINT "VitalReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MeasurementDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
