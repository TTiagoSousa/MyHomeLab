-- CreateTable
CREATE TABLE "AgentSetting" (
    "id" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSetting_agentKey_key" ON "AgentSetting"("agentKey");
