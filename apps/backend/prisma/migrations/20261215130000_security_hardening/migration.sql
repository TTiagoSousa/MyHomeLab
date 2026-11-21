-- AlterTable
ALTER TABLE "ServerConnection" ADD COLUMN     "sshHostKey" TEXT,
ADD COLUMN     "sshHostKeyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

