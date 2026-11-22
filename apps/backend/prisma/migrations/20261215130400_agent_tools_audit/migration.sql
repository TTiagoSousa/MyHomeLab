-- Instalações antigas: as ferramentas dos agentes iguais às dos modelos de agora.
-- O infra instala as atualizações do Home Assistant (ha_update_install) e lê o que precisa;
-- o Smart Home também recebe a ferramenta.
UPDATE "Agent" SET "tools" = "tools" || ARRAY(SELECT t FROM unnest(ARRAY['ha_overview','ha_list_entities','ha_get_entity','ha_list_configs','ha_system_log','ha_update_install']::TEXT[]) AS t WHERE NOT (t = ANY("tools"))), "updatedAt" = NOW()
WHERE "template" = 'infra';
UPDATE "Agent" SET "tools" = "tools" || ARRAY['ha_update_install']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'smarthome' AND NOT ('ha_update_install' = ANY("tools"));

-- As Tarefas no CEO, no admin e no infra.
UPDATE "Agent" SET "tools" = "tools" || ARRAY(SELECT t FROM unnest(ARRAY['todo_lists','todo_list','todo_create','todo_update','todo_delete','todo_create_list']::TEXT[]) AS t WHERE NOT (t = ANY("tools"))), "updatedAt" = NOW()
WHERE "template" IN ('ceo','admin','infra');

-- O infra abre os updates novos e mexe no intervalo das listas do AdGuard.
UPDATE "Agent" SET "tools" = "tools" || ARRAY(SELECT t FROM unnest(ARRAY['update_list_new','update_start','adguard_set_filter_interval']::TEXT[]) AS t WHERE NOT (t = ANY("tools"))), "updatedAt" = NOW()
WHERE "template" = 'infra';

-- O docs_decide é só do CEO; os avisos de disco são do infra, não do Operador Proxmox.
UPDATE "Agent" SET "tools" = array_remove("tools", 'docs_decide'), "updatedAt" = NOW()
WHERE "template" = 'infra' AND 'docs_decide' = ANY("tools");
UPDATE "Agent" SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t NOT LIKE 'disk\_alert\_%'), "updatedAt" = NOW()
WHERE "template" = 'proxmox';
