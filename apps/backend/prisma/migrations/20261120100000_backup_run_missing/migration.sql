-- AlterTable
ALTER TABLE "BackupRun" ADD COLUMN     "missing" TEXT[] DEFAULT ARRAY[]::TEXT[];
