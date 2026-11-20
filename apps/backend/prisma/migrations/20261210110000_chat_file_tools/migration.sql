-- Toda a equipa recebe as ferramentas dos ficheiros do chat (ler, calcular e perguntar a um ficheiro que ele mandou).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['chat_files_list', 'chat_file_read', 'chat_file_query', 'chat_file_ask']::TEXT[], "updatedAt" = NOW()
WHERE NOT ('chat_file_read' = ANY("tools"));
