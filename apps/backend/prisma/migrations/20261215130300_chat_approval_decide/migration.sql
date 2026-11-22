-- AlterEnum
ALTER TYPE "ChatApprovalKind" ADD VALUE 'UPDATE_INSTALL';

-- O Jarvis decide os cartões do chat (enviar um email, mudar a equipa, instalar) quando
-- ele lho diz numa mensagem nova.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['approval_decide']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('approval_decide' = ANY("tools"));
