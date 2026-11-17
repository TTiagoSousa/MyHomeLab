-- AlterEnum
ALTER TYPE "BackupDestinationKind" ADD VALUE 'LOCAL';

-- AlterTable
ALTER TABLE "BackupJob" ALTER COLUMN "accountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InstanceBackupSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "password" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceBackupSetting_pkey" PRIMARY KEY ("id")
);

