-- O quadro de tarefas: quem tem os agendamentos ganha as ferramentas do quadro.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['board_list', 'board_get', 'board_create', 'board_update', 'board_comment', 'board_ask_user']::TEXT[], "updatedAt" = NOW()
WHERE 'schedule_list' = ANY("tools") AND NOT ('board_list' = ANY("tools"));

-- As ferramentas do Forgejo não estavam no catálogo: o Engenheiro de Infraestrutura passa a tê-las.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['forgejo_list_repos', 'forgejo_list_issues', 'forgejo_get_issue', 'forgejo_list_releases', 'forgejo_list_commits', 'forgejo_list_action_runs', 'forgejo_create_issue', 'forgejo_comment_issue', 'forgejo_set_issue_state']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('forgejo_list_repos' = ANY("tools"));
