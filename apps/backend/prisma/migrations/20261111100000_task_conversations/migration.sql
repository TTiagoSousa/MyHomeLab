-- A conversa com o Jarvis ligada a uma tarefa do quadro (uma por tarefa).
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "boardTaskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_boardTaskId_key" ON "Conversation"("boardTaskId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_boardTaskId_fkey" FOREIGN KEY ("boardTaskId") REFERENCES "BoardTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

