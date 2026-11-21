#!/usr/bin/env bash
# Funções partilhadas pelo install.sh, update.sh, restore.sh, backup.sh e config.sh.
# Corre dentro do CT, como root. Não se executa sozinho: faz-se `source`.

# Usadas pelos scripts que fazem source deste ficheiro.
# shellcheck disable=SC2034
APP_USER="${APP_USER:-myhomelab}"
# A pasta do repo. A cópia do root (ROOT_LIB) traz o install.env com ela; a partir do
# próprio repo (install.sh, ou um update.sh antigo a passar para o novo) é a de cima.
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${APP_DIR:-}" ]; then
  if [ -f "$LIB_DIR/install.env" ]; then
    # shellcheck source=/dev/null
    . "$LIB_DIR/install.env"
  elif [ -d "$LIB_DIR/../../.git" ]; then
    APP_DIR="$(cd "$LIB_DIR/../.." && pwd)"
  fi
fi
APP_DIR="${APP_DIR:-/opt/myhomelab}"
APP_HOME="/var/lib/myhomelab"
ENV_FILE="${ENV_FILE:-/etc/myhomelab/myhomelab.env}"
WEB_ROOT="/var/www/myhomelab"
SERVICE="myhomelab"
BACKUP_DIR="/var/backups/myhomelab"
DB_NAME="myhomelab"
DB_USER="myhomelab"
BACKEND_PORT=3000
# Where the app asks for updates and restores and reads their progress (see
# configure_updater). The parent belongs to root: the app user owns $APP_HOME and could
# swap a folder in there for one of its own.
#   requests/  the app user writes the requests here, and nothing else
#   state/     root writes the status, the logs and the lock; the app only reads them
UPDATES_DIR="/var/lib/myhomelab-updates"
REQUESTS_DIR="$UPDATES_DIR/requests"
STATE_DIR="$UPDATES_DIR/state"
# Older versions kept all of it in one folder of the app user.
LEGACY_UPDATES_DIR="$APP_HOME/updates"
# The scripts root runs (systemd units, cron, /usr/bin/myhomelab-*) are a copy owned by
# root — never the files in $APP_DIR, which the app user (and whatever runs as it, the
# backend or an npm postinstall) can change.
ROOT_LIB="/usr/local/lib/myhomelab"
ROOT_SCRIPTS=(lib.sh update.sh restore.sh backup.sh config.sh)
# What the configure step of myhomelab-update rewrites; saved before and put back by the
# rollback (snapshot_system / restore_system).
SYSTEM_PATHS=(
  "/etc/systemd/system/${SERVICE}.service"
  /etc/systemd/system/myhomelab-updater.path
  /etc/systemd/system/myhomelab-updater.service
  /etc/systemd/system/myhomelab-restore.path
  /etc/systemd/system/myhomelab-restore.service
  /etc/systemd/system/postgresql@.service.d/myhomelab.conf
  /etc/nginx/sites-available/myhomelab
  /etc/nginx/snippets/myhomelab-headers.conf
  /etc/cron.d/myhomelab-backup
  /usr/bin/myhomelab-update
  /usr/bin/myhomelab-config
  /usr/bin/myhomelab-restore
  "$ROOT_LIB"
)

msg()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

require_root() { [ "$(id -u)" -eq 0 ] || die "Run this as root."; }

# Um ficheiro normal e não um atalho: nas pastas do utilizador da app, um nome pode ser
# um symlink para um ficheiro do sistema.
regular_file() { [ -f "$1" ] && [ ! -L "$1" ]; }

# Corre um comando como o utilizador da app, na pasta do repo, com o HOME dele (é
# lá que fica a cache do npm — fora do repo).
as_app() {
  runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="/usr/local/bin:/usr/bin:/bin" "$@"
}

# Carrega o ficheiro de ambiente para os comandos seguintes (o Prisma precisa do
# DATABASE_URL nas migrações).
load_env() {
  [ -f "$ENV_FILE" ] || die "Missing $ENV_FILE — run install.sh first."
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

# --- pastas dos pedidos e do estado ------------------------------------------------

# Cria (ou corrige, numa instalação antiga) as pastas dos pedidos e do estado. O
# $UPDATES_DIR é do root, por isso o utilizador da app não consegue pôr lá nomes seus.
ensure_update_dirs() {
  mkdir -p "$UPDATES_DIR" "$REQUESTS_DIR" "$STATE_DIR"
  chown root:root "$UPDATES_DIR"
  chmod 755 "$UPDATES_DIR"
  chown "$APP_USER:$APP_USER" "$REQUESTS_DIR"
  chmod 750 "$REQUESTS_DIR"
  chown root:"$APP_USER" "$STATE_DIR"
  chmod 750 "$STATE_DIR"
}

# write_state_file NAME < conteúdo — escreve $STATE_DIR/NAME de forma atómica (mktemp
# na própria pasta e mv), legível pelo backend.
write_state_file() {
  local tmp
  tmp="$(mktemp "$STATE_DIR/.tmp.XXXXXX")"
  cat > "$tmp"
  chgrp "$APP_USER" "$tmp"
  chmod 640 "$tmp"
  mv -f "$tmp" "$STATE_DIR/$1"
}

# start_state_log NAME — começa $STATE_DIR/NAME vazio e manda para lá (e para o
# terminal) todo o output a partir daqui.
start_state_log() {
  write_state_file "$1" < /dev/null
  exec > >(tee -a "$STATE_DIR/$1") 2>&1
}

# --- a cópia dos scripts do root ---------------------------------------------------

# stage_root_scripts SRC DEST — copia os scripts de SRC (uma pasta do repo, do
# utilizador da app) para DEST, uma pasta nova só do root. Os ficheiros são lidos como o
# utilizador da app: um symlink lá dentro não faz o root copiar um ficheiro do sistema.
stage_root_scripts() {
  local src="$1" dest="$2" file
  mkdir -p "$dest"
  chown root:root "$dest"
  chmod 755 "$dest"
  for file in "${ROOT_SCRIPTS[@]}"; do
    if ! as_app test -f "$src/$file"; then
      case "$file" in
        lib.sh|update.sh) warn "Missing $src/$file."; return 1 ;;
        *) continue ;;
      esac
    fi
    as_app cat "$src/$file" > "$dest/$file" || return 1
    chown root:root "$dest/$file"
    if [ "$file" = lib.sh ]; then chmod 644 "$dest/$file"; else chmod 755 "$dest/$file"; fi
  done
  printf 'APP_DIR=%q\n' "$APP_DIR" > "$dest/install.env"
  chmod 644 "$dest/install.env"
}

# install_root_scripts STAGED — põe em $ROOT_LIB os scripts já copiados por
# stage_root_scripts (pasta do root).
install_root_scripts() {
  local tmp
  msg "Installing the maintenance scripts in $ROOT_LIB…"
  mkdir -p "$(dirname "$ROOT_LIB")"
  tmp="$(mktemp -d "${ROOT_LIB}.new.XXXXXX")"
  cp -a "$1/." "$tmp/"
  chown -R root:root "$tmp"
  chmod 755 "$tmp"
  rm -rf "$ROOT_LIB"
  mv "$tmp" "$ROOT_LIB"
}

# refresh_root_scripts SRC — as duas de cima de seguida (install.sh).
refresh_root_scripts() {
  local work
  work="$(mktemp -d /var/tmp/myhomelab-scripts.XXXXXX)"
  stage_root_scripts "$1" "$work/scripts" || return 1
  install_root_scripts "$work/scripts" || return 1
  rm -rf "$work"
}

# snapshot_system FILE — guarda num tar o que o passo configure vai reescrever.
snapshot_system() {
  local existing=() path
  for path in "${SYSTEM_PATHS[@]}"; do
    if [ -e "$path" ] || [ -L "$path" ]; then existing+=("$path"); fi
  done
  tar -cPpf "$1" -T /dev/null "${existing[@]}"
}

# restore_system FILE — repõe o que snapshot_system guardou (e apaga o que não existia).
restore_system() {
  msg "Putting back the previous services, nginx site and scripts…"
  rm -rf "${SYSTEM_PATHS[@]}"
  tar -xPpf "$1" || return 1
  systemctl daemon-reload
  systemctl restart myhomelab-updater.path myhomelab-restore.path 2>/dev/null || true
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx; else warn "nginx -t fails after the rollback."; return 1; fi
}

# --- build, base de dados e serviço --------------------------------------------------

# Dependências, shared, backend e frontend. O frontend é compilado para a API em
# /api, que o nginx encaminha para o backend.
build_app() {
  msg "Installing dependencies (npm ci)…"
  # --include=dev: o build precisa do Nest CLI, do Vite e do TypeScript, e o
  # NODE_ENV=production do ficheiro de ambiente faria o npm saltá-los.
  ( cd "$APP_DIR" && as_app npm ci --include=dev --no-audit --no-fund )
  msg "Building the shared package, backend and frontend…"
  load_env
  ( cd "$APP_DIR" && as_app npm run build:shared )
  # O prisma.config.ts lê o DATABASE_URL mesmo só para gerar o cliente.
  ( cd "$APP_DIR" && as_app env DATABASE_URL="$DATABASE_URL" npm run build -w @myhomelab/backend )
  ( cd "$APP_DIR" && as_app env VITE_API_URL=/api npm run build -w @myhomelab/frontend )
}

# Dump da base de dados antes de uma atualização (as migrações podem apagar dados e o
# rollback do código não os traz de volta). Fica em $BACKUP_DIR com os dumps do cron,
# e é apagado com eles ao fim de 14 dias. Deixa o caminho em DB_DUMP.
# O argumento opcional dá o fim do nome (por omissão before-update).
dump_db() {
  ensure_postgres
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  DB_DUMP="$BACKUP_DIR/$DB_NAME-$(date +%Y%m%d-%H%M)-${1:-before-update}.sql.gz"
  msg "Saving the database to $DB_DUMP…"
  runuser -u postgres -- pg_dump --clean --if-exists "$DB_NAME" | gzip > "$DB_DUMP.tmp"
  mv "$DB_DUMP.tmp" "$DB_DUMP"
  chmod 600 "$DB_DUMP"
}

# Garante que o PostgreSQL aceita ligações. Se o OOM killer o matou, o cluster fica
# parado (o postgresql.service continua "active (exited)"): arranca os clusters e espera.
ensure_postgres() {
  local cluster
  runuser -u postgres -- pg_isready -q 2>/dev/null && return 0
  warn "PostgreSQL is not accepting connections — starting it…"
  for cluster in $(pg_lsclusters -h 2>/dev/null | awk '{print $1 "-" $2}'); do
    systemctl start "postgresql@${cluster}" || true
  done
  for _ in $(seq 1 30); do
    runuser -u postgres -- pg_isready -q 2>/dev/null && return 0
    sleep 1
  done
  warn "PostgreSQL did not start. Logs: journalctl -u 'postgresql@*' -n 50"
  return 1
}

# Sem memória, o kernel deve matar o backend (ou o Claude Code que ele lança) e não o
# PostgreSQL; e se mesmo assim o matar, o systemd volta a arrancá-lo. Sem isto ficava
# parado até alguém reparar, e os dumps do cron e das atualizações falhavam.
configure_postgres() {
  mkdir -p /etc/systemd/system/postgresql@.service.d
  cat > /etc/systemd/system/postgresql@.service.d/myhomelab.conf <<'EOF'
[Service]
OOMScoreAdjust=-900
Restart=on-failure
RestartSec=5
EOF
  systemctl daemon-reload
}

# Repõe a base de dados de um dump: recria-a vazia (assim também saem as tabelas que
# as migrações novas criaram) e carrega o dump. O backend tem de estar parado.
restore_db() {
  local dump="$1"
  msg "Restoring the database from $dump…"
  systemctl stop "$SERVICE"
  runuser -u postgres -- dropdb --if-exists --force "$DB_NAME"
  runuser -u postgres -- createdb -O "$DB_USER" "$DB_NAME"
  gunzip -c "$dump" | runuser -u postgres -- psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" > /dev/null
}

migrate_db() {
  msg "Applying database migrations…"
  load_env
  ( cd "$APP_DIR/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy )
}

publish_frontend() {
  msg "Publishing the frontend to $WEB_ROOT…"
  mkdir -p "$WEB_ROOT"
  rm -rf "${WEB_ROOT:?}"/*
  cp -r "$APP_DIR/apps/frontend/dist/." "$WEB_ROOT/"
  chown -R root:root "$WEB_ROOT"
  chmod -R a+rX "$WEB_ROOT"
}

restart_backend() {
  msg "Restarting the backend…"
  systemctl restart "$SERVICE"
  wait_backend
}

# O npm ci e o build chegam aos 600 MB com o backend ainda a correr. Se faltar
# memória, o OOM killer deve matar o backend (o systemd volta a arrancá-lo) e não
# a atualização: um npm ci morto a meio deixa o node_modules apagado e o backend
# sem arrancar. Os filhos herdam o valor deste processo.
protect_from_oom() {
  echo -900 > "/proc/$$/oom_score_adj" 2>/dev/null || true
  local pid
  pid="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || true)"
  if [ -n "$pid" ] && [ "$pid" != 0 ]; then
    echo 1000 > "/proc/$pid/oom_score_adj" 2>/dev/null || true
  fi
}

# Espera até o backend responder (o Nest demora uns segundos a arrancar).
wait_backend() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  warn "The backend did not answer within 60 s. Logs: journalctl -u $SERVICE -n 100"
  return 1
}

# The systemd unit and the nginx site are (re)written by install.sh and by
# myhomelab-update, so changes to them in the repo reach installed containers.
configure_service() {
msg "Configuring the $SERVICE service…"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=MyHomeLab (backend)
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/backend
EnvironmentFile=${ENV_FILE}
Environment=APP_DIR=${APP_DIR}
Environment=SYSTEM_UPDATES_DIR=${UPDATES_DIR}
Environment=HOME=${APP_HOME}
ExecStart=/usr/local/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5
# O primeiro a sair quando falta memória (volta em 5 s); o PostgreSQL fica (configure_postgres).
# Os processos do Claude Code sobem para 1000 (claudeCode.runner) e saem antes do backend;
# OOMPolicy=continue evita que um deles morto pare o serviço inteiro.
OOMScoreAdjust=500
OOMPolicy=continue
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
}

# O Claude Code (a IA dos agentes, com a subscrição): o binário oficial pelo npm, em
# /usr/local/bin. A sessão fica em $APP_HOME/.claude (claude auth login como o
# utilizador da app) ou num token guardado em Definições → IA. Não falha a instalação.
install_claude_code() {
  msg "Installing Claude Code…"
  # Em / e não no repo: o npm, como root, leria o .npmrc da pasta onde está, e o repo é
  # do utilizador da app.
  if ( cd / && npm install -g --no-fund --no-audit @anthropic-ai/claude-code >/dev/null 2>&1 ); then
    msg "Claude Code $(cd / && claude --version 2>/dev/null | head -1)"
  else
    warn "Claude Code could not be installed now (the agents need it). Try: npm install -g @anthropic-ai/claude-code"
  fi
}

configure_nginx() {
msg "Configuring nginx…"
# A location with its own add_header does not inherit the server's, so the security
# headers live in a snippet included in the server and in each of those locations.
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/myhomelab-headers.conf <<'EOF'
# Written by MyHomeLab (deploy/proxmox/lib.sh) — myhomelab-update overwrites it.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "frame-ancestors 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
EOF
cat > /etc/nginx/sites-available/myhomelab <<EOF
# The protocol the browser really used: Nginx Proxy Manager terminates https and
# sends X-Forwarded-Proto; opened by IP there is no header and it is this nginx's.
# The backend uses it to decide whether the session cookie is "secure".
map \$http_x_forwarded_proto \$myhomelab_proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root ${WEB_ROOT};
    index index.html;

    server_tokens off;
    include /etc/nginx/snippets/myhomelab-headers.conf;

    # Uploads grandes (exports de dados) passam pelo backend.
    client_max_body_size 300m;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$myhomelab_proto;
        proxy_set_header Connection "";
        # nosniff already comes from the snippet (some routes set it too: no duplicate).
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header X-Powered-By;

        # O estado ao vivo dos agentes é SSE: sem buffering e com ligação longa,
        # senão a página fica em "Tempo real: em baixo".
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
    }

    # Ficheiros com hash no nome: podem ficar em cache para sempre.
    location /assets/ {
        expires 1y;
        include /etc/nginx/snippets/myhomelab-headers.conf;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location = /env-config.js {
        include /etc/nginx/snippets/myhomelab-headers.conf;
        add_header Cache-Control "no-store";
    }
    location = /index.html {
        include /etc/nginx/snippets/myhomelab-headers.conf;
        add_header Cache-Control "no-cache";
    }

    # SPA: qualquer rota volta ao index.html.
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/myhomelab /etc/nginx/sites-enabled/myhomelab
rm -f /etc/nginx/sites-enabled/default
# return and not die: in myhomelab-update this runs inside a step, and the failure has
# to reach the rollback.
nginx -t >/dev/null 2>&1 || { nginx -t; warn "Invalid nginx configuration."; return 1; }
systemctl enable --now nginx >/dev/null
systemctl reload nginx
}

# In-app updates. The backend runs unprivileged and only writes
# $REQUESTS_DIR/request with the version to install; this .path unit (root) sees the
# file appear and runs update.sh — the root copy in $ROOT_LIB — which writes its
# progress to $STATE_DIR/status.json and its output to $STATE_DIR/update.log.
configure_updater() {
  msg "Configuring in-app updates…"
  ensure_update_dirs

  cat > /etc/systemd/system/myhomelab-updater.path <<EOF
[Unit]
Description=MyHomeLab — watch for update requests from the app

[Path]
PathExists=${REQUESTS_DIR}/request
Unit=myhomelab-updater.service

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/myhomelab-updater.service <<EOF
[Unit]
Description=MyHomeLab — update requested from the app

[Service]
Type=oneshot
Environment=LANG=C.UTF-8 LC_ALL=C.UTF-8
# Sem memória, o OOM killer deve escolher outro processo; e se matar um passo
# (ex: o npm ci), o script continua e faz rollback em vez de ser parado a meio.
OOMScoreAdjust=-900
OOMPolicy=continue
ExecStart=/usr/bin/bash ${ROOT_LIB}/update.sh --from-request
EOF

  # A reposição de um backup pedida pela app (Admin → Backup): o mesmo mecanismo.
  cat > /etc/systemd/system/myhomelab-restore.path <<EOF
[Unit]
Description=MyHomeLab — watch for backup restore requests from the app

[Path]
PathExists=${REQUESTS_DIR}/restore-request
Unit=myhomelab-restore.service

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/myhomelab-restore.service <<EOF
[Unit]
Description=MyHomeLab — backup restore requested from the app

[Service]
Type=oneshot
Environment=LANG=C.UTF-8 LC_ALL=C.UTF-8
OOMScoreAdjust=-900
OOMPolicy=continue
ExecStart=/usr/bin/bash ${ROOT_LIB}/restore.sh --from-request
EOF

  systemctl daemon-reload
  systemctl enable myhomelab-updater.path >/dev/null 2>&1
  systemctl enable myhomelab-restore.path >/dev/null 2>&1
  # restart and not just --now: an existing unit has to start watching the new path.
  systemctl restart myhomelab-updater.path myhomelab-restore.path >/dev/null 2>&1
}

# Dump diário da base de dados às 03:30 (guarda 14 dias), pela cópia do root do backup.sh.
configure_backup_cron() {
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  cat > /etc/cron.d/myhomelab-backup <<EOF
# Dump diário da base de dados às 03:30 (guarda 14 dias). Um snapshot do container
# com o Postgres a correr nem sempre é consistente; o dump é.
30 3 * * * root ${ROOT_LIB}/backup.sh >/var/log/myhomelab-backup.log 2>&1
EOF
}

# myhomelab-update / myhomelab-config / myhomelab-restore, pointing at the root copy.
# In /usr/bin and not /usr/local/bin: the shell opened by `pct enter` / `pct exec` does
# not always have /usr/local/bin in its PATH.
install_commands() {
  ln -sfn "$ROOT_LIB/update.sh" /usr/bin/myhomelab-update
  ln -sfn "$ROOT_LIB/config.sh" /usr/bin/myhomelab-config
  ln -sfn "$ROOT_LIB/restore.sh" /usr/bin/myhomelab-restore
  rm -f /usr/local/bin/myhomelab-update /usr/local/bin/myhomelab-config
}
