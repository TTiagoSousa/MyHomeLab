-- CreateTable
CREATE TABLE "BloodOxygenDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "avgSpo2" DOUBLE PRECISION NOT NULL,
    "minSpo2" INTEGER NOT NULL,
    "maxSpo2" INTEGER NOT NULL,
    "minAt" INTEGER,
    "maxAt" INTEGER,
    "nightAvg" DOUBLE PRECISION,
    "samples" INTEGER NOT NULL,
    "ranges" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodOxygenDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodOxygenDay_userId_day_idx" ON "BloodOxygenDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "BloodOxygenDay_userId_source_day_key" ON "BloodOxygenDay"("userId", "source", "day");

-- AddForeignKey
ALTER TABLE "BloodOxygenDay" ADD CONSTRAINT "BloodOxygenDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

