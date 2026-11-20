v1.9.0 — Diez apps nuevas, archivos en el chat y Google Drive

### Novedades
- **Apps nuevas**: conecta Plane, Gitea Mirror, Jellyfin, Dispatcharr, Coolify, Nginx Proxy Manager, ClickHouse, PostgreSQL, Vaultwarden e Infisical. Cada una tiene su página, comprobación de versión y herramientas de los agentes para ver y, solo cuando lo pides, cambiar. Jarvis se encarga de Plane, Jellyfin y Dispatcharr, e Infra del resto. Borrar algo siempre pide tu confirmación antes. Gitea Mirror y Coolify también conectan su propio MCP a Claude Code.
- **Copias de seguridad de las apps nuevas**: los ajustes de Jellyfin, la base de datos de Dispatcharr, el inventario de Coolify, los hosts y certificados de Nginx Proxy Manager (sin claves privadas), el esquema de ClickHouse, un `pg_dump` de PostgreSQL, los ajustes y usuarios de Vaultwarden y los secretos de Infisical. La copia de Infisical guarda los valores en texto plano, así que guárdala en un destino privado.
- **Archivos en el chat**: envía archivos PDF, Word y Excel a Jarvis y los lee.
- **Google Drive y Sheets**: conecta tu cuenta de Google. Jarvis lee tus archivos y solo escribe en las carpetas vinculadas a un proyecto. También crea proyectos y carpetas, y da formato de tabla a las hojas con encabezado, filas fijas, listas con colores, resaltados, filtros y bordes.
