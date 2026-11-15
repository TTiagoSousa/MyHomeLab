-- CreateTable
CREATE TABLE "AssistantPermissionSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "denied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPermissionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantPermissionSetting_userId_key" ON "AssistantPermissionSetting"("userId");

-- AddForeignKey
ALTER TABLE "AssistantPermissionSetting" ADD CONSTRAINT "AssistantPermissionSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

