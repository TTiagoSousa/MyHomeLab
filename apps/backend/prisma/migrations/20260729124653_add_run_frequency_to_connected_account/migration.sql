-- CreateEnum
CREATE TYPE "RunFrequency" AS ENUM ('HOURLY', 'DAILY');

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "runFrequency" "RunFrequency" NOT NULL DEFAULT 'HOURLY';
