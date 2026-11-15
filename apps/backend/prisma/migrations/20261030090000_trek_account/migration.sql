-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'TREK';

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "appPassword" TEXT;

