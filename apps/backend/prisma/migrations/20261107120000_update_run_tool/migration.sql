-- Quem prepara as atualizações também as corre (a aprovação do utilizador passa a estar nas regras).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['update_run']::TEXT[], "updatedAt" = NOW()
WHERE 'update_prepare' = ANY("tools") AND NOT ('update_run' = ANY("tools"));
