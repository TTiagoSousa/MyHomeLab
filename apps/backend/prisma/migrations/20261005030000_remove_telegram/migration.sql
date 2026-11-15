-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "source";

-- AlterTable
ALTER TABLE "ConnectedAccount" DROP COLUMN "digestEnabled",
DROP COLUMN "digestHour",
DROP COLUMN "lastDigestSentAt";

-- DropEnum
DROP TYPE "ChatSource";

