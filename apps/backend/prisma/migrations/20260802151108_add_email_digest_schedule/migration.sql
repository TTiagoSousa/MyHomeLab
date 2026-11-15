-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestHour" INTEGER,
ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3);
