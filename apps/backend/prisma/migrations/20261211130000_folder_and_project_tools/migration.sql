-- O Jarvis e o Arquivista passam a criar pastas no Drive; o Jarvis passa a criar projetos.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['drive_create_folder']::TEXT[], "updatedAt" = NOW()
WHERE "template" IN ('ceo', 'archivist') AND 'drive_read' = ANY("tools") AND NOT ('drive_create_folder' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['board_project_create']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND 'board_create' = ANY("tools") AND NOT ('board_project_create' = ANY("tools"));
