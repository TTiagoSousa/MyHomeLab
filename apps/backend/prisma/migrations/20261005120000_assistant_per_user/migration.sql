-- O assistente passa a ser de cada utilizador: a conversa, as instruções dos
-- subagentes e a chave de IA. O que já existia fica com o primeiro admin.

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC');

-- CreateTable
CREATE TABLE "AiCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiCredential_userId_provider_key" ON "AiCredential"("userId", "provider");

-- AddForeignKey
ALTER TABLE "AiCredential" ADD CONSTRAINT "AiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatMessage: dono = primeiro admin (ou o utilizador mais antigo).
ALTER TABLE "ChatMessage" ADD COLUMN "userId" TEXT;
UPDATE "ChatMessage" SET "userId" = (
    SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
);
DELETE FROM "ChatMessage" WHERE "userId" IS NULL;
ALTER TABLE "ChatMessage" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX "ChatMessage_createdAt_idx";
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentSetting: o mesmo dono.
ALTER TABLE "AgentSetting" ADD COLUMN "userId" TEXT;
UPDATE "AgentSetting" SET "userId" = (
    SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
);
DELETE FROM "AgentSetting" WHERE "userId" IS NULL;
ALTER TABLE "AgentSetting" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX "AgentSetting_agentKey_key";
CREATE UNIQUE INDEX "AgentSetting_userId_agentKey_key" ON "AgentSetting"("userId", "agentKey");
ALTER TABLE "AgentSetting" ADD CONSTRAINT "AgentSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
