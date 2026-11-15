-- O Engenheiro de Smart Home entra nas equipas que já existem (as novas recebem-no do template).
INSERT INTO "Agent" ("id", "userId", "key", "name", "description", "template", "prompt", "extraPrompt", "model", "effort", "tools", "reportsToId", "color", "position", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ceo."userId",
  'smarthome',
  'Engenheiro de Smart Home',
  'Trata da casa no Home Assistant: vê e controla dispositivos (luzes, clima, estores, cenas), organiza entidades e áreas, e cria, afina ou apaga automações, scripts e cenas.',
  'smarthome',
  NULL,
  NULL,
  'SONNET',
  'MEDIUM',
  ARRAY['ha_overview', 'ha_list_entities', 'ha_get_entity', 'ha_list_services', 'ha_list_configs', 'ha_get_config', 'ha_system_log', 'ha_call_service', 'ha_save_config', 'ha_delete_config', 'ha_update_entity']::TEXT[],
  ceo."id",
  7,
  (SELECT COALESCE(MAX(a."position"), 0) + 1 FROM "Agent" a WHERE a."userId" = ceo."userId"),
  true,
  NOW(),
  NOW()
FROM "Agent" ceo
WHERE ceo."reportsToId" IS NULL
  AND ceo."template" = 'ceo'
  AND NOT EXISTS (SELECT 1 FROM "Agent" x WHERE x."userId" = ceo."userId" AND x."key" = 'smarthome');

-- As ferramentas do Home Assistant passam do Engenheiro de Infraestrutura para ele.
UPDATE "Agent"
SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t NOT LIKE 'ha\_%'), "updatedAt" = NOW()
WHERE "template" = 'infra' AND EXISTS (SELECT 1 FROM unnest("tools") AS t WHERE t LIKE 'ha\_%');

-- O Jarvis (CEO) passa a criar, mudar e apagar agentes.
UPDATE "Agent"
SET "tools" = ARRAY['list_team', 'list_available_tools', 'create_agent', 'update_agent', 'delete_agent']::TEXT[] || "tools", "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('create_agent' = ANY("tools"));

-- O Home Assistant deixa de ser do Engenheiro de Infraestrutura: a descrição antiga levava lá os pedidos da casa.
UPDATE "Agent"
SET "description" = 'Vigia e analisa os servidores (Proxmox, serviços e alertas, discos e backups) e o Forgejo (repositórios, issues, releases e CI).', "updatedAt" = NOW()
WHERE "template" = 'infra' AND "description" LIKE '%Home Assistant%';
