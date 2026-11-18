-- O Engenheiro de Infraestrutura (quem corre comandos por SSH) também trata dos avisos de disco:
-- vê o que ocupa o espaço e limpa.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['disk_alert_get', 'disk_alert_save_study', 'disk_alert_grow', 'disk_alert_ask', 'disk_alert_done']::TEXT[], "updatedAt" = NOW()
WHERE 'server_run_command' = ANY("tools") AND NOT ('disk_alert_get' = ANY("tools"));
