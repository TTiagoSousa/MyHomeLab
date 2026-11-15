-- AlterEnum
ALTER TYPE "ConnectionProvider" ADD VALUE 'ADGUARD';

-- O Engenheiro de Infraestrutura das equipas que já existem passa a tratar do AdGuard.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['adguard_overview', 'adguard_query_log', 'adguard_check_domain', 'adguard_list_filters', 'adguard_get_settings', 'adguard_set_protection', 'adguard_set_domain_rule', 'adguard_set_user_rules', 'adguard_manage_filter', 'adguard_refresh_filters', 'adguard_manage_rewrite', 'adguard_set_blocked_services']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('adguard_overview' = ANY("tools"));

UPDATE "Agent"
SET "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor, trata do AdGuard (DNS e bloqueios da rede) e do Forgejo (repositórios, issues, releases e CI).', "updatedAt" = NOW()
WHERE "template" = 'infra' AND "description" = 'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), corre comandos com a tua aprovação, escreve o guia de cada servidor e trata do Forgejo (repositórios, issues, releases e CI).';
