-- AlterTable
ALTER TABLE "AppUpdate" ADD COLUMN     "hostServerId" TEXT,
ALTER COLUMN "accountId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UpdateAttempt" ADD COLUMN     "hostServerId" TEXT,
ALTER COLUMN "accountId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AppUpdate_hostServerId_idx" ON "AppUpdate"("hostServerId");

-- CreateIndex
CREATE INDEX "UpdateAttempt_hostServerId_startedAt_idx" ON "UpdateAttempt"("hostServerId", "startedAt");

-- AddForeignKey
ALTER TABLE "AppUpdate" ADD CONSTRAINT "AppUpdate_hostServerId_fkey" FOREIGN KEY ("hostServerId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateAttempt" ADD CONSTRAINT "UpdateAttempt_hostServerId_fkey" FOREIGN KEY ("hostServerId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Uma atualização (e a tentativa) é de uma app ou do host de um servidor: sempre um e só um.
ALTER TABLE "AppUpdate" ADD CONSTRAINT "AppUpdate_target_check" CHECK (num_nonnulls("accountId", "hostServerId") = 1);
ALTER TABLE "UpdateAttempt" ADD CONSTRAINT "UpdateAttempt_target_check" CHECK (num_nonnulls("accountId", "hostServerId") = 1);
