-- CreateEnum
CREATE TYPE "AgentLogKind" AS ENUM ('REQUEST', 'START', 'ACTION', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "kind" "AgentLogKind" NOT NULL,
    "text" TEXT NOT NULL,
    "requestedBy" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentLog_userId_createdAt_idx" ON "AgentLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

