-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "typeId" TEXT;

-- CreateTable
CREATE TABLE "DocType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocType_userId_name_key" ON "DocType"("userId", "name");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "DocType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocType" ADD CONSTRAINT "DocType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

