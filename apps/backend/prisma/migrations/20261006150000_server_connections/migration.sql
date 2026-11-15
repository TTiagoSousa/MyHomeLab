-- CreateEnum
CREATE TYPE "ServerKind" AS ENUM ('PROXMOX');

-- CreateTable
CREATE TABLE "ServerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ServerKind" NOT NULL DEFAULT 'PROXMOX',
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8006,
    "tokenId" TEXT NOT NULL,
    "tokenSecret" TEXT NOT NULL,
    "verifyTls" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerConnection_userId_name_key" ON "ServerConnection"("userId", "name");

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
