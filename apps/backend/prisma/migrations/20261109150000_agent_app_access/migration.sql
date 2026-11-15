-- As permissões de cada agente em cada app ligada ou servidor.
-- CreateEnum
CREATE TYPE "AppAccessLevel" AS ENUM ('NONE', 'READ', 'WRITE');

-- CreateTable
CREATE TABLE "AgentAppAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "level" "AppAccessLevel" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentAppAccess_userId_targetType_targetId_agentKey_key" ON "AgentAppAccess"("userId", "targetType", "targetId", "agentKey");

-- AddForeignKey
ALTER TABLE "AgentAppAccess" ADD CONSTRAINT "AgentAppAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

