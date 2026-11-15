-- Os disparos podem pôr a resposta numa conversa do Jarvis; o resumo da manhã passa a ser um disparo (sai a tabela dele).
-- DropForeignKey
ALTER TABLE "BriefingSetting" DROP CONSTRAINT "BriefingSetting_userId_fkey";

-- AlterTable
ALTER TABLE "AgentSchedule" ADD COLUMN     "toChat" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "BriefingSetting";

