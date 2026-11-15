/*
  Warnings:

  - You are about to drop the column `labelMode` on the `EmailRule` table. All the data in the column will be lost.
  - You are about to drop the column `path1` on the `EmailRule` table. All the data in the column will be lost.
  - You are about to drop the column `path2` on the `EmailRule` table. All the data in the column will be lost.
  - You are about to drop the column `path3` on the `EmailRule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmailRule" DROP COLUMN "labelMode",
DROP COLUMN "path1",
DROP COLUMN "path2",
DROP COLUMN "path3",
ADD COLUMN     "removeFromInbox" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailRuleLabelPath" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "labelMode" "LabelMode" NOT NULL DEFAULT 'ALL_LEVELS',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmailRuleLabelPath_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailRuleLabelPath_ruleId_order_idx" ON "EmailRuleLabelPath"("ruleId", "order");

-- AddForeignKey
ALTER TABLE "EmailRuleLabelPath" ADD CONSTRAINT "EmailRuleLabelPath_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EmailRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
