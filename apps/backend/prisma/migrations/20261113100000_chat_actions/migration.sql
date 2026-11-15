-- O que a equipa fez em cada resposta do assistente (vai no histórico para o modelo).
ALTER TABLE "ChatMessage" ADD COLUMN "actions" JSONB;
