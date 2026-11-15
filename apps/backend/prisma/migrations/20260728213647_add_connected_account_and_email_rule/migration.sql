-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'IMAP');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('CONTAINS', 'EXACT', 'REGEX');

-- CreateEnum
CREATE TYPE "LabelMode" AS ENUM ('LEAF_ONLY', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "ConditionLogic" AS ENUM ('ALL', 'ANY');

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "conditionLogic" "ConditionLogic" NOT NULL DEFAULT 'ALL',
    "fromContains" TEXT[],
    "subjectContains" TEXT[],
    "keywords" TEXT[],
    "excludeKeywords" TEXT[],
    "matchType" "MatchType" NOT NULL DEFAULT 'CONTAINS',
    "hasAttachment" BOOLEAN,
    "markAsRead" BOOLEAN NOT NULL DEFAULT false,
    "markAsImportant" BOOLEAN NOT NULL DEFAULT false,
    "markAsStarred" BOOLEAN NOT NULL DEFAULT false,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "removeFromInboxAfterDays" INTEGER,
    "removeOnlyIfRead" BOOLEAN NOT NULL DEFAULT false,
    "starredExpiresAfterDays" INTEGER,
    "importantExpiresAfterDays" INTEGER,
    "importantExpiresOnStar" BOOLEAN NOT NULL DEFAULT false,
    "labelMode" "LabelMode" NOT NULL DEFAULT 'ALL_LEVELS',
    "path1" TEXT,
    "path2" TEXT,
    "path3" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectedAccount_userId_idx" ON "ConnectedAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_emailAddress_key" ON "ConnectedAccount"("userId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailRule_accountId_order_idx" ON "EmailRule"("accountId", "order");

-- CreateIndex
CREATE INDEX "EmailRule_accountId_isActive_idx" ON "EmailRule"("accountId", "isActive");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRule" ADD CONSTRAINT "EmailRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
