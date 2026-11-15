-- Quem valida os pontos das tentativas também as fecha quando pára.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['update_attempt_close']::TEXT[], "updatedAt" = NOW()
WHERE 'update_check' = ANY("tools") AND NOT ('update_attempt_close' = ANY("tools"));
