v1.9.0 — Dez apps novas, ficheiros no chat e Google Drive

### Novidades
- **Apps novas**: liga o Plane, o Gitea Mirror, o Jellyfin, o Dispatcharr, o Coolify, o Nginx Proxy Manager, o ClickHouse, o PostgreSQL, o Vaultwarden e o Infisical. Cada um tem a sua página, verificação de versão e ferramentas dos agentes para ver e, só quando pedes, mudar. O Jarvis trata do Plane, do Jellyfin e do Dispatcharr, e o Infra do resto. Apagar alguma coisa pede sempre a tua confirmação primeiro. O Gitea Mirror e o Coolify ligam também o MCP deles ao Claude Code.
- **Backups das apps novas**: as definições do Jellyfin, a base de dados do Dispatcharr, o inventário do Coolify, os hosts e certificados do Nginx Proxy Manager (sem chaves privadas), o esquema do ClickHouse, um `pg_dump` do PostgreSQL, as definições e utilizadores do Vaultwarden e os segredos do Infisical. O backup do Infisical guarda os valores em texto simples, por isso guarda-o num destino privado.
- **Ficheiros no chat**: manda ficheiros PDF, Word e Excel ao Jarvis e ele lê-os.
- **Google Drive e Sheets**: liga a tua conta Google. O Jarvis lê os teus ficheiros e só escreve nas pastas ligadas a um projeto. Também cria projetos e pastas, e formata folhas como tabelas com cabeçalho, linhas fixas, listas com cores, destaques, filtros e margens.
