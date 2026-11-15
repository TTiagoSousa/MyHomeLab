-- O guia do servidor passa a ser só um documento: sai o estado do estudo e as ferramentas próprias.
ALTER TABLE "ServerConnection" DROP COLUMN "guideStudyAt";

-- Quem escrevia o guia passa a escrevê-lo como documento (docs_write / docs_propose).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_write']::TEXT[], "updatedAt" = NOW()
WHERE 'server_save_guide' = ANY("tools") AND NOT ('docs_write' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_propose']::TEXT[], "updatedAt" = NOW()
WHERE 'server_save_guide' = ANY("tools") AND NOT ('docs_propose' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_read']::TEXT[], "updatedAt" = NOW()
WHERE 'server_read_guide' = ANY("tools") AND NOT ('docs_read' = ANY("tools"));

UPDATE "Agent"
SET "tools" = array_remove(array_remove("tools", 'server_read_guide'), 'server_save_guide'), "updatedAt" = NOW()
WHERE 'server_read_guide' = ANY("tools") OR 'server_save_guide' = ANY("tools");
