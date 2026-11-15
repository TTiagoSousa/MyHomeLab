-- As ferramentas das integrações antigas já não existem: saem dos agentes.
UPDATE "Agent" SET "tools" = ARRAY(
  SELECT tool FROM unnest("tools") AS tool
  WHERE tool NOT IN (
    'adguard_status', 'adguard_refresh_lists', 'home_assistant_updates',
    'home_assistant_backups', 'run_home_assistant_backup', 'nginx_proxy_hosts',
    'nginx_certificate_alert', 'coolify_resources', 'nextcloud_status', 'save_backup_job'
  )
);
