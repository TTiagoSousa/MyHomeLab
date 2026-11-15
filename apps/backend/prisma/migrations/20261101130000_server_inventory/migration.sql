-- O inventário do servidor (um só comando de leitura) para quem já corre comandos.
UPDATE "Agent"
SET "tools" = array_append("tools", 'server_inventory'), "updatedAt" = NOW()
WHERE 'server_run_command' = ANY("tools") AND NOT ('server_inventory' = ANY("tools"));
