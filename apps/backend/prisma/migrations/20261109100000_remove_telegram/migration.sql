-- O Telegram sai do site (a app Android fala com o assistente).
-- DropForeignKey
ALTER TABLE "TelegramBot" DROP CONSTRAINT "TelegramBot_userId_fkey";

-- AlterTable
ALTER TABLE "BriefingSetting" DROP COLUMN "sendTelegram";

-- DropTable
DROP TABLE "TelegramBot";

