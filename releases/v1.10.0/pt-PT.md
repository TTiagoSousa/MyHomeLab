v1.10.0 — Saem os backups das apps

### Mudanças
- **Saem os backups das apps**: o MyHomeLab deixa de fazer backups das apps ligadas. A maior parte desses backups não chegava para repor a app sozinha (só as definições, ou uma lista do que refazer), por isso o backup completo de uma app passa a ser o da própria app ou o do CT/VM no Proxmox. O cartão de backups sai das páginas das apps e os backups de apps que tinhas agendados deixam de correr. Os ficheiros que já estão nos teus destinos ficam lá.
- **O backup do próprio MyHomeLab fica**: Admin → Backup funciona como antes, com os destinos (Nextcloud ou este servidor) em Apps ligadas → Backups.
- **Atualizações**: antes de atualizar uma app, as regras pedem agora um backup recente do CT/VM no Proxmox (o Operador Proxmox faz um se faltar) e, onde ajuda, o backup da própria app. As peças do Home Assistant atualizam-se com o backup do próprio Home Assistant (`backup: true`).
- **Agentes**: `list_backups` e `run_backup` passam a tratar só do backup do MyHomeLab e mandam as apps para o backup do Proxmox. As ferramentas dos backups próprios das apps (Dispatcharr, Jellyfin, Vaultwarden, Immich) ficam iguais.
