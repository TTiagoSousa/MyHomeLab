-- Apps ligadas novas: Jellyfin, Dispatcharr, Coolify, Nginx Proxy Manager, ClickHouse, PostgreSQL, Vaultwarden, Infisical.
ALTER TYPE "ConnectionProvider" ADD VALUE 'JELLYFIN';
ALTER TYPE "ConnectionProvider" ADD VALUE 'DISPATCHARR';
ALTER TYPE "ConnectionProvider" ADD VALUE 'COOLIFY';
ALTER TYPE "ConnectionProvider" ADD VALUE 'NGINX_PROXY_MANAGER';
ALTER TYPE "ConnectionProvider" ADD VALUE 'CLICKHOUSE';
ALTER TYPE "ConnectionProvider" ADD VALUE 'POSTGRES';
ALTER TYPE "ConnectionProvider" ADD VALUE 'VAULTWARDEN';
ALTER TYPE "ConnectionProvider" ADD VALUE 'INFISICAL';
