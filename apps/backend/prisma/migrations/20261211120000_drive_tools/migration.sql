-- O Jarvis e o Arquivista recebem as ferramentas do Google Drive (ler o Drive todo; mudar só o que estiver ligado a um projeto).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['drive_search', 'drive_links', 'drive_read', 'drive_sheet_query', 'drive_ask', 'drive_history', 'drive_sheet_update', 'drive_sheet_append', 'drive_sheet_add_tab', 'drive_create', 'drive_convert_to_sheet']::TEXT[], "updatedAt" = NOW()
WHERE "template" IN ('ceo', 'archivist') AND NOT ('drive_read' = ANY("tools"));
