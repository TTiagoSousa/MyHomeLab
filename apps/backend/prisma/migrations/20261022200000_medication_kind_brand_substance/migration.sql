-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'MEDICATION',
ADD COLUMN     "substance" TEXT;
