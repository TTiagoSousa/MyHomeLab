-- O Assistente Administrativo também trabalha nas tarefas do quadro que são dele.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['board_list', 'board_get', 'board_create', 'board_update', 'board_comment', 'board_ask_user']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'admin' AND NOT ('board_list' = ANY("tools"));
