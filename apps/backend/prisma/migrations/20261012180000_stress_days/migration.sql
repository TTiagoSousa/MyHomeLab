-- CreateTable
CREATE TABLE "StressDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "timeZone" TEXT,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "minAt" INTEGER,
    "maxAt" INTEGER,
    "samples" INTEGER NOT NULL,
    "levels" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StressDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StressDay_userId_day_idx" ON "StressDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StressDay_userId_source_day_key" ON "StressDay"("userId", "source", "day");

-- AddForeignKey
ALTER TABLE "StressDay" ADD CONSTRAINT "StressDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

