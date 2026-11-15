-- CreateEnum
CREATE TYPE "ServerCommandStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'REJECTED', 'BLOCKED');

-- AlterTable
ALTER TABLE "ServerConnection" ADD COLUMN     "guide" TEXT,
ADD COLUMN     "guideStudyAt" TIMESTAMP(3),
ADD COLUMN     "guideUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "sshPort" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "sshPrivateKey" TEXT,
ADD COLUMN     "sshPublicKey" TEXT,
ADD COLUMN     "sshUser" TEXT;

-- CreateTable
CREATE TABLE "ServerCommand" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverConnectionId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ServerCommandStatus" NOT NULL,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TEXT,
    "turnId" TEXT,
    "output" TEXT,
    "exitCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ServerCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerCommand_serverConnectionId_createdAt_idx" ON "ServerCommand"("serverConnectionId", "createdAt");

-- CreateIndex
CREATE INDEX "ServerCommand_userId_code_idx" ON "ServerCommand"("userId", "code");

-- AddForeignKey
ALTER TABLE "ServerCommand" ADD CONSTRAINT "ServerCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerCommand" ADD CONSTRAINT "ServerCommand_serverConnectionId_fkey" FOREIGN KEY ("serverConnectionId") REFERENCES "ServerConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- O Operador Proxmox (nível 1) entra nas equipas que já existem, a responder ao Engenheiro de Infraestrutura.
INSERT INTO "Agent" ("id", "userId", "key", "name", "description", "template", "prompt", "extraPrompt", "model", "effort", "tools", "reportsToId", "color", "position", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  infra."userId",
  'proxmox',
  'Operador Proxmox',
  'Mexe nas máquinas do Proxmox pela API: liga, desliga e reinicia VMs e CTs, snapshots, backups e recursos (CPU, RAM, disco).',
  'proxmox',
  NULL,
  NULL,
  'SONNET',
  'LOW',
  ARRAY['list_servers', 'list_proxmox_guests', 'get_guest_status', 'pve_guest_config', 'pve_list_snapshots', 'pve_guest_power', 'pve_create_snapshot', 'pve_rollback_snapshot', 'pve_delete_snapshot', 'pve_backup_now', 'pve_set_resources']::TEXT[],
  infra."id",
  8,
  (SELECT COALESCE(MAX(a."position"), 0) + 1 FROM "Agent" a WHERE a."userId" = infra."userId"),
  true,
  NOW(),
  NOW()
FROM "Agent" infra
WHERE infra."template" = 'infra'
  AND NOT EXISTS (SELECT 1 FROM "Agent" x WHERE x."userId" = infra."userId" AND x."key" = 'proxmox');

-- O Engenheiro de Infraestrutura (nível 2) recebe os comandos e o guia do servidor.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['server_read_guide', 'server_command_history', 'server_run_command', 'server_run_approved', 'server_reject_command', 'server_save_guide']::TEXT[],
    "description" = CASE
      WHEN "description" = 'Vigia e analisa os servidores (Proxmox, serviços e alertas, discos e backups) e o Forgejo (repositórios, issues, releases e CI).'
      THEN 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor e trata do Forgejo (repositórios, issues, releases e CI).'
      ELSE "description"
    END,
    "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('server_run_command' = ANY("tools"));
