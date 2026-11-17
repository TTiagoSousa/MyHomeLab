-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "DocSection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocSection_userId_idx" ON "DocSection"("userId");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DocSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSection" ADD CONSTRAINT "DocSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocSection" ADD CONSTRAINT "DocSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

