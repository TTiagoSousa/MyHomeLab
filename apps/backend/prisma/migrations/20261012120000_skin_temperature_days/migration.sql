-- CreateTable
CREATE TABLE "SkinTemperatureDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "avgTemp" DOUBLE PRECISION NOT NULL,
    "minTemp" DOUBLE PRECISION NOT NULL,
    "maxTemp" DOUBLE PRECISION NOT NULL,
    "minAt" INTEGER,
    "maxAt" INTEGER,
    "nightAvg" DOUBLE PRECISION,
    "samples" INTEGER NOT NULL,
    "ranges" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinTemperatureDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkinTemperatureDay_userId_day_idx" ON "SkinTemperatureDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "SkinTemperatureDay_userId_source_day_key" ON "SkinTemperatureDay"("userId", "source", "day");

-- AddForeignKey
ALTER TABLE "SkinTemperatureDay" ADD CONSTRAINT "SkinTemperatureDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

