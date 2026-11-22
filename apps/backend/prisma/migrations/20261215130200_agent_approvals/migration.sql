-- CreateEnum
CREATE TYPE "ChatApprovalKind" AS ENUM ('EMAIL_SEND', 'AGENT_CHANGE');

-- CreateEnum
CREATE TYPE "ChatApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ChatApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ChatApprovalKind" NOT NULL,
    "status" "ChatApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "proposedBy" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" TEXT,
    "conversationId" TEXT,
    "turnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ChatApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatApproval_userId_status_idx" ON "ChatApproval"("userId", "status");

-- CreateIndex
CREATE INDEX "ChatApproval_conversationId_idx" ON "ChatApproval"("conversationId");

-- AddForeignKey
ALTER TABLE "ChatApproval" ADD CONSTRAINT "ChatApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatApproval" ADD CONSTRAINT "ChatApproval_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As chaves "user", "myhomelab" e "system" querem dizer o utilizador e o próprio
-- MyHomeLab (quem fez uma ação). Um agente com uma delas passava por eles: muda para
-- "agente-<chave>", e tudo o que apontava para ela também.
DO $$
DECLARE
  reserved TEXT;
BEGIN
  FOREACH reserved IN ARRAY ARRAY['user', 'myhomelab', 'system'] LOOP
    UPDATE "AgentSchedule" s SET "agentKey" = 'agente-' || reserved
      WHERE s."agentKey" = reserved AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."userId" = s."userId" AND a."key" = reserved);
    UPDATE "AgentSetting" s SET "agentKey" = 'agente-' || reserved
      WHERE s."agentKey" = reserved AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."userId" = s."userId" AND a."key" = reserved);
    UPDATE "AgentAppAccess" s SET "agentKey" = 'agente-' || reserved
      WHERE s."agentKey" = reserved AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."userId" = s."userId" AND a."key" = reserved);
    UPDATE "DocLink" l SET "targetId" = 'agente-' || reserved
      WHERE l."type" = 'AGENT' AND l."targetId" = reserved
        AND EXISTS (SELECT 1 FROM "Doc" d JOIN "Agent" a ON a."userId" = d."userId" WHERE d."id" = l."docId" AND a."key" = reserved);
    UPDATE "Project" p SET "agentKeys" = array_replace(p."agentKeys", reserved, 'agente-' || reserved)
      WHERE reserved = ANY(p."agentKeys") AND EXISTS (SELECT 1 FROM "Agent" a WHERE a."userId" = p."userId" AND a."key" = reserved);
    UPDATE "Agent" SET "key" = 'agente-' || reserved, "updatedAt" = NOW() WHERE "key" = reserved;
  END LOOP;
END $$;
