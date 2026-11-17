#!/usr/bin/env bash
# Repõe um backup do MyHomeLab (o .zip com uma pasta por área, de Admin → Backup): todos
# os dados e as chaves (TOKEN_ENCRYPTION_KEY, JWT_SECRET, Google). Tudo o que existe agora
# é substituído pelo que está no backup.
#
#   myhomelab-restore <backup.zip>      no CT, como root (pede a password do backup)
#   restore.sh --from-request           pedido pela app (Admin → Backup → Repor): a app já
#                                       confirmou a password e deixou o .zip e a password em
#                                       $UPDATES_DIR/restore/
#
# Antes de mexer guarda um dump da base de dados atual e uma cópia do .env; se um passo
# falhar, volta a eles. Os dados entram pelo backend (dist/src/cli/backup-tool.js import),
# tabela a tabela, a partir dos .jsonl do backup. O progresso vai para restore-status.json
# e o output para restore.log.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"
export PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$APP_DIR"

STATUS_FILE="$UPDATES_DIR/restore-status.json"
LOG_FILE="$UPDATES_DIR/restore.log"
REQUEST_DIR="$UPDATES_DIR/restore"
TOOL="$APP_DIR/apps/backend/dist/src/cli/backup-tool.js"
BACKUP_CREATED_AT=""
STARTED_AT="$(date -Is)"

json() {
  local s="$1"
  s="${s//\/\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/}"
  printf '"%s"' "$s"
}

# status STATE STEP MESSAGE — escrito de forma atómica; a app lê-o.
status() {
  local finished=null
  case "$1" in success|failed) finished="$(json "$(date -Is)")" ;; esac
  {
    printf '{"state":%s,"step":%s,"message":%s,"backupCreatedAt":%s,' \
      "$(json "$1")" "$(json "$2")" "$(json "$3")" "$(json "$BACKUP_CREATED_AT")"
    printf '"startedAt":%s,"finishedAt":%s}\n' "$(json "$STARTED_AT")" "$finished"
  } > "$STATUS_FILE.tmp"
  chmod 644 "$STATUS_FILE.tmp"
  mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

mkdir -p "$UPDATES_DIR"
chown "$APP_USER:$APP_USER" "$UPDATES_DIR"
# Uma coisa de cada vez: o mesmo cadeado das atualizações.
exec 9>"$UPDATES_DIR/.lock"
flock -n 9 || die "An update or a restore is already running."

WORK="$(mktemp -d /var/tmp/myhomelab-restore.XXXXXX)"
chmod 700 "$WORK"
FROM_REQUEST=0
cleanup() {
  rm -rf "$WORK"
  if [ "$FROM_REQUEST" = 1 ]; then rm -rf "$REQUEST_DIR"; fi
}
trap cleanup EXIT

[ -f "$TOOL" ] || die "Missing $TOOL — build the backend first (myhomelab-update)."

if [ "${1:-}" = "--from-request" ]; then
  [ -f "$UPDATES_DIR/restore-request" ] || exit 0
  request="$(tr -d '[:space:]' < "$UPDATES_DIR/restore-request")"
  # Apagado logo: enquanto existir, a unit .path volta a disparar.
  rm -f "$UPDATES_DIR/restore-request"
  FROM_REQUEST=1
  : > "$LOG_FILE"
  chmod 644 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
  if [ "$request" != "restore/backup.zip" ] || [ ! -f "$REQUEST_DIR/backup.zip" ] || [ ! -f "$REQUEST_DIR/password" ]; then
    status failed request "Invalid restore request"
    die "Invalid restore request: '$request'"
  fi
  ZIP="$REQUEST_DIR/backup.zip"
  MYHOMELAB_BACKUP_PASSWORD="$(cat "$REQUEST_DIR/password")"
  rm -f "$REQUEST_DIR/password"
else
  ZIP="${1:-}"
  if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
    die "Usage: myhomelab-restore <backup.zip>"
  fi
  if [ -z "${MYHOMELAB_BACKUP_PASSWORD:-}" ]; then
    read -rsp "Backup password: " MYHOMELAB_BACKUP_PASSWORD
    echo
  fi
fi
export MYHOMELAB_BACKUP_PASSWORD

status running check "Reading the backup"
if ! summary="$(node "$TOOL" check "$ZIP" 2>&1)"; then
  status failed check "$summary"
  die "$summary"
fi
BACKUP_CREATED_AT="$(printf '%s' "$summary" | sed -n 's/^Backup from \([^ ]*\).*/\1/p')"
msg "$summary"

if [ "$FROM_REQUEST" = 0 ]; then
  warn "This replaces ALL MyHomeLab data (and its keys) with the backup."
  read -rp "Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || die "Cancelled."
  : > "$LOG_FILE"
  chmod 644 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

STEP=""
REPLACED=0
DB_DUMP=""
ENV_BEFORE="$WORK/env.before"
KEYS="$WORK/keys.env"
rollback() {
  trap - ERR
  set +e
  warn "Step '$STEP' failed — putting back what was there before."
  status running rollback "Step '$STEP' failed — restoring the previous data"
  local restored=true
  if [ "$REPLACED" = 1 ]; then
    if [ -f "$ENV_BEFORE" ]; then cp "$ENV_BEFORE" "$ENV_FILE"; fi
    restore_db "$DB_DUMP" || restored=false
  fi
  systemctl start "$SERVICE"
  if $restored && wait_backend; then
    status failed "$STEP" "Restore failed at '$STEP'. The previous data is back."
  else
    status failed "$STEP" "Restore failed at '$STEP' and putting the previous data back failed too. Check restore.log."
  fi
  exit 1
}
set -E
trap rollback ERR
step() { STEP="$1"; status running "$1" "$2"; }

step dump "Saving the current database"
dump_db before-restore
cp "$ENV_FILE" "$ENV_BEFORE"

step database "Restoring the data"
load_env
systemctl stop "$SERVICE"
REPLACED=1
node "$TOOL" import "$ZIP" "$KEYS"

step keys "Restoring the keys"
node "$TOOL" merge-env "$KEYS" "$ENV_FILE"

step migrate "Applying database migrations"
migrate_db

step start "Starting MyHomeLab"
systemctl start "$SERVICE"
wait_backend

trap - ERR
status success "done" "Restored the backup from ${BACKUP_CREATED_AT:-an unknown date}"
msg "Restored. Sign in again: the sessions belong to the restored data."
