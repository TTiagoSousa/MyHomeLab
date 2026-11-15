-- AlterEnum
ALTER TYPE "AiProvider" ADD VALUE 'OPENAI';

-- AlterTable
ALTER TABLE "AiCredential" ADD COLUMN     "agentModel" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mainModel" TEXT;

-- Até aqui só havia o Claude: a chave que cada um tem fica a ser a usada.
UPDATE "AiCredential" SET "isActive" = true;
