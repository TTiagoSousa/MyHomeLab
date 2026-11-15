-- CreateTable
CREATE TABLE "TelegramBot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "linkCode" TEXT NOT NULL,
    "chatId" TEXT,
    "chatName" TEXT,
    "linkedAt" TIMESTAMP(3),
    "lastUpdateId" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramBot_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "TelegramBot_userId_key" ON "TelegramBot"("userId");
-- AddForeignKey
ALTER TABLE "TelegramBot" ADD CONSTRAINT "TelegramBot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
