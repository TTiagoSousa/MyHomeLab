v1.9.0 — Ten new apps, files in the chat and Google Drive

### Features
- **New apps**: connect Plane, Gitea Mirror, Jellyfin, Dispatcharr, Coolify, Nginx Proxy Manager, ClickHouse, PostgreSQL, Vaultwarden and Infisical. Each one has its page, version checks and agent tools to read and, only when you ask, change things. Jarvis handles Plane, Jellyfin and Dispatcharr, and Infra handles the rest. Deleting something always needs your confirmation first. Gitea Mirror and Coolify also connect their own MCP servers to Claude Code.
- **Backups for the new apps**: Jellyfin settings, the Dispatcharr database, the Coolify inventory, the Nginx Proxy Manager hosts and certificates (without private keys), the ClickHouse schema, a PostgreSQL `pg_dump`, the Vaultwarden settings and users, and the Infisical secrets. The Infisical backup holds the values in plain text, so keep it in a private destination.
- **Files in the chat**: send PDF, Word and Excel files to Jarvis and it reads them.
- **Google Drive and Sheets**: connect your Google account. Jarvis reads your files and writes only in the folders linked to a project. It can also create projects and folders, and format sheets as tables with headers, frozen rows, coloured dropdowns, highlights, filters and borders.
