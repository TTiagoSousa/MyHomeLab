-- CreateEnum
CREATE TYPE "AgentModel" AS ENUM ('OPUS', 'SONNET');

-- CreateEnum
CREATE TYPE "AgentEffort" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "template" TEXT,
    "prompt" TEXT,
    "extraPrompt" TEXT,
    "model" "AgentModel" NOT NULL DEFAULT 'SONNET',
    "effort" "AgentEffort" NOT NULL DEFAULT 'LOW',
    "tools" TEXT[],
    "reportsToId" TEXT,
    "color" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key_key" ON "Agent"("userId", "key");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

