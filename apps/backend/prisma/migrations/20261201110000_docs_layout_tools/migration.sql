-- Os agentes que propõem nos documentos passam a ver a página Documentos como o
-- utilizador a vê (docs_layout) e a saber a que se pode ligar um documento (docs_targets).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['docs_layout', 'docs_targets']::TEXT[], "updatedAt" = NOW()
WHERE 'docs_propose' = ANY("tools") AND NOT ('docs_layout' = ANY("tools"));
