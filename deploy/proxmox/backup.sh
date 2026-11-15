#!/usr/bin/env bash
# Dump da base de dados para /var/backups/myhomelab, comprimido, mantendo 14 dias.
# Corre pelo cron (/etc/cron.d/myhomelab-backup); pode correr-se à mão.
#
# Repor:  gunzip -c <ficheiro> | runuser -u postgres -- psql -d myhomelab
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

file="$BACKUP_DIR/myhomelab-$(date +%Y%m%d-%H%M).sql.gz"
runuser -u postgres -- pg_dump --clean --if-exists myhomelab | gzip > "$file.tmp"
mv "$file.tmp" "$file"
chmod 600 "$file"

find "$BACKUP_DIR" -name 'myhomelab-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
msg "Backup: $file ($(du -h "$file" | cut -f1))"
