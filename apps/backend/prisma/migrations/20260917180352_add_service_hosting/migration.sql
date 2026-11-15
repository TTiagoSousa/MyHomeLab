-- CreateEnum
CREATE TYPE "ServiceHosting" AS ENUM ('SELF_HOSTED', 'CLOUD');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "hosting" "ServiceHosting" NOT NULL DEFAULT 'SELF_HOSTED';
