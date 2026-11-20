-- O Jarvis e o Arquivista passam a mudar o aspeto das folhas ligadas (tabela, cabeçalho, menus, tipos de coluna, cores).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['drive_sheet_format']::TEXT[], "updatedAt" = NOW()
WHERE "template" IN ('ceo', 'archivist') AND 'drive_read' = ANY("tools") AND NOT ('drive_sheet_format' = ANY("tools"));
