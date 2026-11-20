-- As ferramentas das apps novas para o agente de cada uma.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['jellyfin_overview', 'jellyfin_libraries', 'jellyfin_search', 'jellyfin_sessions', 'jellyfin_users', 'jellyfin_tasks', 'jellyfin_activity', 'jellyfin_scan', 'jellyfin_session_control', 'jellyfin_user_manage', 'jellyfin_task_run', 'jellyfin_restart', 'jellyfin_server_backup']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('jellyfin_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['dispatcharr_overview', 'dispatcharr_channels', 'dispatcharr_streams', 'dispatcharr_connections', 'dispatcharr_channel_edit', 'dispatcharr_channel_create', 'dispatcharr_channel_delete', 'dispatcharr_refresh', 'dispatcharr_stop', 'dispatcharr_recordings', 'dispatcharr_backups']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'ceo' AND NOT ('dispatcharr_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['coolify_overview', 'coolify_resources', 'coolify_resource', 'coolify_deploy', 'coolify_control', 'coolify_deployments', 'coolify_logs', 'coolify_envs', 'coolify_set_env', 'coolify_server']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('coolify_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['nginx_proxy_manager_overview', 'nginx_proxy_manager_hosts', 'nginx_proxy_manager_host', 'nginx_proxy_manager_create_host', 'nginx_proxy_manager_update_host', 'nginx_proxy_manager_toggle_host', 'nginx_proxy_manager_delete_host', 'nginx_proxy_manager_certificates', 'nginx_proxy_manager_renew_certificate', 'nginx_proxy_manager_access_lists', 'nginx_proxy_manager_audit']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('nginx_proxy_manager_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['clickhouse_overview', 'clickhouse_tables', 'clickhouse_describe', 'clickhouse_query', 'clickhouse_execute', 'clickhouse_queries', 'clickhouse_kill', 'clickhouse_health']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('clickhouse_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['postgres_overview', 'postgres_tables', 'postgres_describe', 'postgres_query', 'postgres_execute', 'postgres_activity', 'postgres_cancel', 'postgres_maintenance']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('postgres_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['vaultwarden_overview', 'vaultwarden_users', 'vaultwarden_organizations', 'vaultwarden_config', 'vaultwarden_invite', 'vaultwarden_user_action', 'vaultwarden_delete_user', 'vaultwarden_backup_db', 'vaultwarden_test_smtp']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('vaultwarden_overview' = ANY("tools"));

UPDATE "Agent"
SET "tools" = "tools" || ARRAY['infisical_overview', 'infisical_secrets', 'infisical_secret_get', 'infisical_folders', 'infisical_secret_set', 'infisical_secret_delete', 'infisical_folder_create']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('infisical_overview' = ANY("tools"));
