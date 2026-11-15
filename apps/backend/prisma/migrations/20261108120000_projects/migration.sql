-- Projetos: os documentos que os agentes seguem para a empresa, uma página, um blog…
-- AlterEnum
ALTER TYPE "DocLinkType" ADD VALUE 'PROJECT';

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "agentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Quem lê os documentos também vê os projetos.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_projects']::TEXT[], "updatedAt" = NOW()
WHERE 'docs_search' = ANY("tools") AND NOT ('docs_projects' = ANY("tools"));
