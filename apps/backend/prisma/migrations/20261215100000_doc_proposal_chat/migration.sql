-- As propostas de documentos feitas no chat ficam ligadas à conversa e à volta.
ALTER TABLE "DocProposal" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "turnId" TEXT;

CREATE INDEX "DocProposal_conversationId_idx" ON "DocProposal"("conversationId");

ALTER TABLE "DocProposal" ADD CONSTRAINT "DocProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O Jarvis passa a poder aprovar ou recusar uma proposta quando ele lho diz no chat.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_decide']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('docs_decide' = ANY("tools"));
