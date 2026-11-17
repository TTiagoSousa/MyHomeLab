#!/usr/bin/env bash
# Repõe um backup do MyHomeLab: a base de dados inteira e as chaves (TOKEN_ENCRYPTION_KEY,
# JWT_SECRET, Google). Tudo o que existe agora é substituído pelo que está no backup.
#
#   myhomelab-restore <ficheiro.mhlbackup>   no CT, como root (pede a password)
#   restore.sh --from-request                pedido pela app (Admin → Backup → Repor): a app
#                                            já decifrou e validou o ficheiro para
#                                            $UPDATES_DIR/restore/backup.tar
#
# Antes de mexer guarda um dump da base de dados atual e uma cópia do .env; se um passo
# falhar, volta a eles. Depois de repor aplica as migrações (um backup de uma versão mais
# antiga fica atualizado). O progresso vai para restore-status.json e o output para restore.log.
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
REQUEST_TAR=""
cleanup() {
  rm -rf "$WORK"
  if [ -n "$REQUEST_TAR" ]; then rm -f "$REQUEST_TAR"; fi
}
trap cleanup EXIT

if [ "${1:-}" = "--from-request" ]; then
  [ -f "$UPDATES_DIR/restore-request" ] || exit 0
  request="$(tr -d '[:space:]' < "$UPDATES_DIR/restore-request")"
  # Apagado logo: enquanto existir, a unit .path volta a disparar.
  rm -f "$UPDATES_DIR/restore-request"
  : > "$LOG_FILE"
  chmod 644 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
  if [ "$request" != "restore/backup.tar" ] || [ ! -f "$UPDATES_DIR/$request" ]; then
    status failed request "Invalid restore request"
    die "Invalid restore request: '$request'"
  fi
  REQUEST_TAR="$UPDATES_DIR/$request"
  TAR="$REQUEST_TAR"
else
  FILE="${1:-}"
  if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    die "Usage: myhomelab-restore <file.mhlbackup>"
  fi
  [ -f "$TOOL" ] || die "Missing $TOOL — build the backend first (myhomelab-update)."
  if [ -z "${MYHOMELAB_BACKUP_PASSWORD:-}" ]; then
    read -rsp "Backup password: " MYHOMELAB_BACKUP_PASSWORD
    echo
  fi
  export MYHOMELAB_BACKUP_PASSWORD
  warn "This replaces ALL MyHomeLab data (and its keys) with the backup."
  read -rp "Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || die "Cancelled."
  : > "$LOG_FILE"
  chmod 644 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
  TAR="$WORK/backup.tar"
  status running decrypt "Decrypting the backup"
  msg "Decrypting $FILE…"
  node "$TOOL" decrypt "$FILE" "$TAR" || { status failed decrypt "Wrong password or not a MyHomeLab backup"; die "Could not decrypt the backup."; }
fi

status running extract "Reading the backup"
mkdir -p "$WORK/backup"
tar -xf "$TAR" -C "$WORK/backup"
for entry in manifest.json database.sql secrets.env; do
  [ -f "$WORK/backup/$entry" ] || { status failed extract "The backup is incomplete ($entry missing)"; die "The backup has no $entry."; }
done
BACKUP_CREATED_AT="$(sed -n 's/.*"createdAt": *"\([^"]*\)".*/\1/p' "$WORK/backup/manifest.json" | head -1)"
msg "Backup from ${BACKUP_CREATED_AT:-an unknown date}."

STEP=""
REPLACED=0
DB_DUMP=""
ENV_BEFORE="$WORK/env.before"
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

step database "Restoring the database"
load_env
systemctl stop "$SERVICE"
REPLACED=1
runuser -u postgres -- dropdb --if-exists --force "$DB_NAME"
runuser -u postgres -- createdb -O "$DB_USER" "$DB_NAME"
# Como o utilizador da app: as tabelas ficam dele (o dump vem sem donos).
psql "${DATABASE_URL%%\?*}" -q -v ON_ERROR_STOP=1 -f "$WORK/backup/database.sql" > /dev/null

step keys "Restoring the keys"
node "$TOOL" merge-env "$WORK/backup/secrets.env" "$ENV_FILE"

step migrate "Applying database migrations"
migrate_db

step start "Starting MyHomeLab"
systemctl start "$SERVICE"
wait_backend

trap - ERR
status success done "Restored the backup from ${BACKUP_CREATED_AT:-an unknown date}"
msg "Restored. Sign in again: the sessions belong to the restored data."
