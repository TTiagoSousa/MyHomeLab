-- CreateEnum
CREATE TYPE "MailKind" AS ENUM ('ANY', 'BULK', 'DIRECT');
-- AlterTable
ALTER TABLE "EmailRule" ADD COLUMN     "mailKind" "MailKind" NOT NULL DEFAULT 'ANY';
