-- Os documentos de processo já criados a cada utilizador (não voltam se ele os apagar).
-- CreateTable
CREATE TABLE "DocSeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocSeed_userId_key_key" ON "DocSeed"("userId", "key");

-- AddForeignKey
ALTER TABLE "DocSeed" ADD CONSTRAINT "DocSeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

