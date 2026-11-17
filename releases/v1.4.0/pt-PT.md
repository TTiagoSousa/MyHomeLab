v1.4.0 — Backups do MyHomeLab numa pasta por área

### Novidades
- **Backup do MyHomeLab**: o backup passa a ser um .zip com password que abre como uma pasta, com uma subpasta por área — agentes, documentos, projetos, tarefas, apps ligadas, IA, servidores, serviços, email, saúde e o resto. Cada tabela vai inteira num ficheiro, os documentos e os prompts dos agentes vão também em Markdown para ler, e em _restauro/ ficam as chaves que leem os logins. Abre-se com o 7-Zip, o WinRAR ou o Mac.
- **Repor**: a reposição lê essas mesmas pastas, tabela a tabela, e já não precisa do pg_dump. Continua pela app (Admin → Backup → Repor um backup) ou com `myhomelab-restore <backup.zip>` no servidor, com volta atrás automática se algo falhar.
