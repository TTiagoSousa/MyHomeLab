-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'FORGEJO';

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "baseUrl" TEXT,
ADD COLUMN     "username" TEXT;

