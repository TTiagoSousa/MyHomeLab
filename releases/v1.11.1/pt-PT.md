v1.11.1 — Avisos de backup e atualizações presas

### Correções
- **Avisos de backup**: os avisos de falha dos backups das apps (que saíram na v1.10.0) nunca fechavam e não se podiam dispensar. Agora fecham sozinhos quando o MyHomeLab arranca. O backup do próprio MyHomeLab continua a avisar como antes.
- **Atualizações**: instalar o Claude Code durante uma atualização passa a ter um limite de 5 minutos. Se o npm pendurar, a atualização mostra um aviso e continua, em vez de ficar presa em "Installing Claude Code…".
