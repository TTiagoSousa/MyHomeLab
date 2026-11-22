#!/usr/bin/env bash
# Repõe um backup do MyHomeLab (o .zip com uma pasta por área, de Admin → Backup): todos
# os dados e as chaves (TOKEN_ENCRYPTION_KEY, JWT_SECRET, Google). Tudo o que existe agora
# é substituído pelo que está no backup.
#
#   myhomelab-restore <backup.zip>      no CT, como root (pede a password do backup)
#   restore.sh --from-request           pedido pela app (Admin → Backup → Repor): a app já
#                                       confirmou a password e deixou o .zip e a password em
#                                       $REQUESTS_DIR/restore/
#
# Antes de mexer guarda um dump da base de dados atual e uma cópia do .env; se um passo
# falhar, volta a eles. Os dados entram pelo backend (dist/src/cli/backup-tool.js import),
# tabela a tabela, a partir dos .jsonl do backup. O backup-tool corre como o utilizador da
# app (o código e o node_modules são dele) e as chaves voltam ao .env por este script, só
# as conhecidas e com valores que a shell não expande. O progresso vai para
# $STATE_DIR/restore-status.json e o output para $STATE_DIR/restore.log.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"
export PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$APP_DIR"

REQUEST_DIR="$REQUESTS_DIR/restore"
TOOL="$APP_DIR/apps/backend/dist/src/cli/backup-tool.js"
BACKUP_CREATED_AT=""
STARTED_AT="$(date -Is)"
# As chaves que um backup pode trazer (INSTANCE_SECRET_KEYS em
# apps/backend/src/backup/helpers/instanceBackup.ts) e os valores aceites: o .env é lido
# pela shell como root (load_env), por isso nada de $, `, \ ou aspas no meio.
BACKUP_ENV_KEYS="TOKEN_ENCRYPTION_KEY JWT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET"
SAFE_ENV_VALUE='^("[A-Za-z0-9+/=._:@~-]*"|[A-Za-z0-9+/=._:@~-]*)$'

json() {
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/}"
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
  } | write_state_file restore-status.json
}

# merge_env_keys KEYS — troca (ou acrescenta) no $ENV_FILE as chaves do ficheiro KEYS,
# que o backup-tool escreveu como o utilizador da app.
merge_env_keys() {
  local keys line key value tmp
  local -A wanted=() replaced=()
  keys="$(as_app cat "$1")" || return 1
  while IFS= read -r line; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case " $BACKUP_ENV_KEYS " in
      *" $key "*) ;;
      *) warn "Ignoring $key from the backup (not one of the backup's keys)."; continue ;;
    esac
    if ! [[ "$value" =~ $SAFE_ENV_VALUE ]]; then
      warn "The value of $key in the backup has characters that are not allowed."
      return 1
    fi
    wanted[$key]="$value"
  done <<<"$keys"

  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  while IFS= read -r line || [ -n "$line" ]; do
    key="${line%%=*}"
    if [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] && [ -n "${wanted[$key]+set}" ]; then
      printf '%s=%s\n' "$key" "${wanted[$key]}"
      replaced[$key]=1
    else
      printf '%s\n' "$line"
    fi
  done < "$ENV_FILE" > "$tmp"
  for key in "${!wanted[@]}"; do
    [ -n "${replaced[$key]+set}" ] || printf '%s=%s\n' "$key" "${wanted[$key]}" >> "$tmp"
  done
  chown root:"$APP_USER" "$tmp"
  chmod 640 "$tmp"
  mv -f "$tmp" "$ENV_FILE"
  msg "Keys restored: ${!wanted[*]}"
}

ensure_update_dirs
# Uma coisa de cada vez: o mesmo cadeado das atualizações.
exec 9>"$STATE_DIR/.lock"
if ! flock -n 9; then
  # Pedido da app com uma atualização a correr: sai o pedido (senão a unit .path volta a
  # disparar) e o .zip e a password (não ficam no disco), e a app vê a falha. Uma
  # reposição a correr usa estes ficheiros: aí não se lhes mexe.
  if [ "${1:-}" = "--from-request" ] && ! grep -q '"state":"running"' "$STATE_DIR/restore-status.json" 2>/dev/null; then
    rm -f "$REQUESTS_DIR/restore-request"
    as_app rm -rf "$REQUEST_DIR" || true
    status failed request "An update or another restore is running. Try again when it finishes."
  fi
  die "An update or a restore is already running."
fi

# WORK: do root (a cópia do .env). APP_WORK: do utilizador da app, onde o backup-tool
# escreve as chaves (e, à mão, a cópia do .zip que ele vai ler).
WORK="$(mktemp -d /var/tmp/myhomelab-restore.XXXXXX)"
chmod 700 "$WORK"
APP_WORK="$(as_app mktemp -d /tmp/myhomelab-restore.XXXXXX)"
FROM_REQUEST=0
cleanup() {
  rm -rf "$WORK"
  as_app rm -rf "$APP_WORK" || true
  if [ "$FROM_REQUEST" = 1 ]; then as_app rm -rf "$REQUEST_DIR" || true; fi
}
trap cleanup EXIT

[ -f "$TOOL" ] || die "Missing $TOOL — build the backend first (myhomelab-update)."

if [ "${1:-}" = "--from-request" ]; then
  request="$REQUESTS_DIR/restore-request"
  [ -e "$request" ] || [ -L "$request" ] || exit 0
  # Lido como o utilizador da app (foi ele que o escreveu): um symlink não faz o root ler
  # um ficheiro do sistema.
  content=""
  if regular_file "$request"; then
    content="$(as_app head -c 64 "$request" | tr -d '[:space:]' || true)"
  fi
  # Apagado logo: enquanto existir, a unit .path volta a disparar.
  rm -f "$request"
  FROM_REQUEST=1
  start_state_log restore.log
  ZIP="$REQUEST_DIR/backup.zip"
  if [ "$content" != "restore/backup.zip" ] || ! regular_file "$ZIP" || ! regular_file "$REQUEST_DIR/password"; then
    status failed request "Invalid restore request"
    die "Invalid restore request: '$content'"
  fi
  MYHOMELAB_BACKUP_PASSWORD="$(as_app cat "$REQUEST_DIR/password")"
  as_app rm -f "$REQUEST_DIR/password"
else
  ZIP="${1:-}"
  if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
    die "Usage: myhomelab-restore <backup.zip>"
  fi
  # O backup-tool corre como o utilizador da app, que pode não conseguir ler o ficheiro
  # onde está (ex: /root): vai uma cópia para a pasta dele.
  as_app tee "$APP_WORK/backup.zip" < "$ZIP" > /dev/null
  ZIP="$APP_WORK/backup.zip"
  if [ -z "${MYHOMELAB_BACKUP_PASSWORD:-}" ]; then
    read -rsp "Backup password: " MYHOMELAB_BACKUP_PASSWORD
    echo
  fi
fi
export MYHOMELAB_BACKUP_PASSWORD

status running check "Reading the backup"
if ! summary="$(as_app node "$TOOL" check "$ZIP" 2>&1)"; then
  status failed check "$summary"
  die "$summary"
fi
BACKUP_CREATED_AT="$(printf '%s' "$summary" | sed -n 's/^Backup from \([^ ]*\).*/\1/p')"
msg "$summary"

if [ "$FROM_REQUEST" = 0 ]; then
  warn "This replaces ALL MyHomeLab data (and its keys) with the backup."
  read -rp "Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || die "Cancelled."
  start_state_log restore.log
fi

STEP=""
REPLACED=0
DB_DUMP=""
ENV_BEFORE="$WORK/env.before"
KEYS="$APP_WORK/keys.env"
rollback() {
  trap - ERR
  set +e
  warn "Step '$STEP' failed — putting back what was there before."
  status running rollback "Step '$STEP' failed — restoring the previous data"
  local restored=true
  if [ "$REPLACED" = 1 ]; then
    if [ -f "$ENV_BEFORE" ]; then cp -p "$ENV_BEFORE" "$ENV_FILE"; fi
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
cp -p "$ENV_FILE" "$ENV_BEFORE"

step database "Restoring the data"
load_env
systemctl stop "$SERVICE"
REPLACED=1
as_app env DATABASE_URL="$DATABASE_URL" node "$TOOL" import "$ZIP" "$KEYS"

step keys "Restoring the keys"
merge_env_keys "$KEYS"

step migrate "Applying database migrations"
migrate_db

step start "Starting MyHomeLab"
systemctl start "$SERVICE"
wait_backend

trap - ERR
status success "done" "Restored the backup from ${BACKUP_CREATED_AT:-an unknown date}"
msg "Restored. Sign in again: the sessions belong to the restored data."
