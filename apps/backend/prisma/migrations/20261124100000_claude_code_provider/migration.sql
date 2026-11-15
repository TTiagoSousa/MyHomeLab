-- A IA passa a ser o Claude Code da máquina, com a subscrição: saem as chaves da
-- API da Anthropic e da OpenAI (os modelos e o limite de custo também, com elas).
DELETE FROM "AiCredential";

ALTER TYPE "AiProvider" RENAME TO "AiProvider_old";
CREATE TYPE "AiProvider" AS ENUM ('CLAUDE_CODE');
ALTER TABLE "AiCredential"
  ALTER COLUMN "provider" TYPE "AiProvider" USING ("provider"::text::"AiProvider");
DROP TYPE "AiProvider_old";
