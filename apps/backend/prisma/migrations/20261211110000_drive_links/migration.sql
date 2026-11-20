-- As pastas e os ficheiros do Drive ligados a um projeto: só nesses o Jarvis altera.
-- CreateTable
CREATE TABLE "DriveLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveLink_userId_idx" ON "DriveLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveLink_accountId_fileId_projectId_key" ON "DriveLink"("accountId", "fileId", "projectId");

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

