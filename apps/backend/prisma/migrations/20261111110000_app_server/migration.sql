-- Onde corre cada app ligada: o servidor e o CT/VM.
-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "guestVmid" INTEGER,
ADD COLUMN     "serverConnectionId" TEXT;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

