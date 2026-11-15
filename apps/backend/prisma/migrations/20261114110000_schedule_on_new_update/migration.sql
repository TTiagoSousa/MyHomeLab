-- AlterEnum
ALTER TYPE "AgentScheduleRepeat" ADD VALUE 'ON_NEW_UPDATE';

-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "announcedAt" TIMESTAMP(3);

