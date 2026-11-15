-- AlterTable
ALTER TABLE "DailyVitals" ADD COLUMN     "avgHr" INTEGER,
ADD COLUMN     "maxHr" INTEGER,
ADD COLUMN     "minHr" INTEGER;

-- CreateTable
CREATE TABLE "HeartRateBucket" (
    "id" TEXT NOT NULL,
    "vitalsId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "avgHr" INTEGER NOT NULL,
    "minHr" INTEGER NOT NULL,
    "maxHr" INTEGER NOT NULL,

    CONSTRAINT "HeartRateBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeartRateBucket_vitalsId_startedAt_key" ON "HeartRateBucket"("vitalsId", "startedAt");

-- AddForeignKey
ALTER TABLE "HeartRateBucket" ADD CONSTRAINT "HeartRateBucket_vitalsId_fkey" FOREIGN KEY ("vitalsId") REFERENCES "DailyVitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

