-- O modo Misto da IA: o fornecedor de cada tipo de trabalho e o limite do Claude Code.
CREATE TABLE "AiRouting" (
    "userId" TEXT NOT NULL,
    "mixed" BOOLEAN NOT NULL DEFAULT false,
    "routes" JSONB,
    "maxClaudeCodeRuns" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRouting_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "AiRouting" ADD CONSTRAINT "AiRouting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
