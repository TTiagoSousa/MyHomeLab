-- O Jarvis recebe as ferramentas do Plane; o Engenheiro de Infraestrutura as do Gitea Mirror.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['plane_overview', 'plane_project', 'plane_list', 'plane_get', 'plane_search', 'plane_create', 'plane_update', 'plane_comment']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('plane_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['gitea_mirror_overview', 'gitea_mirror_repos', 'gitea_mirror_activity', 'gitea_mirror_add', 'gitea_mirror_run', 'gitea_mirror_import']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('gitea_mirror_overview' = ANY("tools"));
