-- Imagens e vídeos dos exercícios, postos pelo admin (nenhum vem de origem).
-- A contagem de imagens estáticas deixa de existir.
-- AlterTable
ALTER TABLE "ExerciseType" DROP COLUMN "images";

-- CreateTable
CREATE TABLE "ExerciseMedia" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseMedia_typeId_position_idx" ON "ExerciseMedia"("typeId", "position");

-- AddForeignKey
ALTER TABLE "ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ExerciseType"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Os vídeos já vêm comprimidos: sem compressão o Postgres lê só o pedaço
-- pedido (substring), em vez do vídeo inteiro, em cada pedido de Range.
ALTER TABLE "ExerciseMedia" ALTER COLUMN "data" SET STORAGE EXTERNAL;
