-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'PLANE';

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN "appWorkspace" TEXT;

-- O Engenheiro de Infraestrutura das equipas que já existem passa a tratar do Plane.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['plane_overview', 'plane_list_work_items', 'plane_get_work_item', 'plane_project_details', 'plane_instance', 'plane_create_work_item', 'plane_update_work_item', 'plane_comment_work_item', 'plane_set_instance_setting']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('plane_overview' = ANY("tools"));

UPDATE "Agent"
SET "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor, trata do AdGuard (DNS e bloqueios da rede), do Forgejo (repositórios, issues, releases e CI) e do Plane (projetos e tarefas).', "updatedAt" = NOW()
WHERE "template" = 'infra' AND "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor, trata do AdGuard (DNS e bloqueios da rede) e do Forgejo (repositórios, issues, releases e CI).';
