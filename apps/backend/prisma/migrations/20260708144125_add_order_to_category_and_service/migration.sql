-- DropIndex
DROP INDEX "Category_userId_idx";

-- DropIndex
DROP INDEX "Service_categoryId_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_userId_order_idx" ON "Category"("userId", "order");

-- CreateIndex
CREATE INDEX "Service_categoryId_order_idx" ON "Service"("categoryId", "order");

-- Backfill: assign sequential order (0..n-1) based on createdAt, per user (Category) / per category (Service)
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt") - 1 AS rn
  FROM "Category"
)
UPDATE "Category" c SET "order" = ranked.rn
FROM ranked
WHERE c."id" = ranked."id";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "createdAt") - 1 AS rn
  FROM "Service"
)
UPDATE "Service" s SET "order" = ranked.rn
FROM ranked
WHERE s."id" = ranked."id";
