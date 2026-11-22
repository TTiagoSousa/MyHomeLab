#!/usr/bin/env bash
# Instala o MyHomeLab dentro de um container Debian 13 (o ct-create.sh chama-o; também
# se pode correr à mão dentro do CT). Corre como root, a partir do repo já clonado.
#
# Deixa a correr: PostgreSQL local, o backend como serviço systemd (127.0.0.1:3000) e
# o nginx na porta 80 a servir o frontend e a encaminhar /api para o backend.
#
# Pode correr-se outra vez sem estragar nada: os segredos e a base de dados que já
# existem ficam como estão.
#
# Variáveis (todas opcionais):
#   APP_URL         endereço por onde se abre a app (omissão: http://<IP do CT>)
#   ADMIN_USERNAME  primeiro utilizador, fica ADMIN (omissão: admin)
#   ADMIN_PASSWORD  password dele (omissão: uma aleatória, mostrada uma vez no fim)
#   ADMIN_PASSWORD_FILE  em vez da de cima, um ficheiro com a password, apagado depois
#                   de lido (o ct-create.sh usa-o para não a pôr na linha de comandos)
#   NODE_MAJOR      versão do Node (omissão: 22)
set -euo pipefail

# The Debian template only ships the C locale; a LANG inherited from the host shell
# (e.g. en_US.UTF-8) makes perl/apt print locale warnings on every command.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
# pct exec does not always include /usr/local/bin, where Node is installed.
export PATH="/usr/local/bin:$PATH"
# Silence the "new version available" banners of npm and Prisma.
export npm_config_update_notifier=false PRISMA_HIDE_UPDATE_MESSAGE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root

NODE_MAJOR="${NODE_MAJOR:-22}"
DB_NAME="myhomelab"
DB_USER="myhomelab"
CREDS_FILE="/root/myhomelab-credentials.txt"
TZ_NAME="Europe/Lisbon"

ip_address() { hostname -I 2>/dev/null | awk '{print $1}'; }
APP_URL="${APP_URL:-http://$(ip_address)}"
APP_URL="${APP_URL%/}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
if [ -n "${ADMIN_PASSWORD_FILE:-}" ]; then
  [ -f "$ADMIN_PASSWORD_FILE" ] || die "ADMIN_PASSWORD_FILE not found: $ADMIN_PASSWORD_FILE"
  ADMIN_PASSWORD="$(cat "$ADMIN_PASSWORD_FILE")"
  rm -f "$ADMIN_PASSWORD_FILE"
fi

random_secret() { openssl rand -base64 "$1" | tr -d '\n'; }

# --- sistema ------------------------------------------------------------------------

msg "Installing system packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl git xz-utils openssl \
  nginx postgresql \
  build-essential python3 \
  tzdata cron >/dev/null

# O resumo das regras e as horas "de hoje" dependem do fuso do processo; sem isto o
# container fica em UTC.
msg "Timezone: $TZ_NAME"
ln -sf "/usr/share/zoneinfo/$TZ_NAME" /etc/localtime
echo "$TZ_NAME" > /etc/timezone

# --- Node ---------------------------------------------------------------------------

install_node() {
  local arch tarball
  case "$(uname -m)" in
    x86_64) arch="x64" ;;
    aarch64) arch="arm64" ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac
  local base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  tarball="$(curl -fsSL "$base/SHASUMS256.txt" | awk -v a="linux-${arch}.tar.xz" '$2 ~ a {print $2; exit}')"
  [ -n "$tarball" ] || die "Node ${NODE_MAJOR} for linux-${arch} not found."
  msg "Installing ${tarball%.tar.xz}…"
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "$base/$tarball" -o "$tmp/$tarball"
  ( cd "$tmp" && curl -fsSL "$base/SHASUMS256.txt" | grep " $tarball\$" | sha256sum -c - >/dev/null ) \
    || die "Node checksum does not match."
  tar -xJf "$tmp/$tarball" -C /usr/local --strip-components=1 \
    --exclude='*/CHANGELOG.md' --exclude='*/LICENSE' --exclude='*/README.md'
  rm -rf "$tmp"
}

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
  install_node
fi
msg "Node $(node -v), npm $(npm -v)"
install_claude_code

# --- utilizador da app --------------------------------------------------------------

if ! id "$APP_USER" >/dev/null 2>&1; then
  msg "Creating system user $APP_USER…"
  useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_HOME"
chown -R "$APP_USER:$APP_USER" "$APP_HOME" "$APP_DIR"

# --- PostgreSQL ---------------------------------------------------------------------

msg "Setting up PostgreSQL…"
systemctl enable --now postgresql >/dev/null
configure_postgres

mkdir -p /etc/myhomelab
chmod 750 /etc/myhomelab

if [ -f "$ENV_FILE" ]; then
  msg "Existing configuration in $ENV_FILE — kept (secrets and database)."
  # Reaproveita a password da base de dados para o caso de ser preciso recriar o role.
  DB_PASS="$(sed -n 's#^DATABASE_URL="postgresql://[^:]*:\([^@]*\)@.*#\1#p' "$ENV_FILE")"
else
  DB_PASS="$(random_secret 24 | tr -d '/+=')"
fi

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  runuser -u postgres -- psql -qc "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  runuser -u postgres -- psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# --- configuração do backend ---------------------------------------------------------

if [ ! -f "$ENV_FILE" ]; then
  msg "Generating $ENV_FILE…"
  cat > "$ENV_FILE" <<EOF
# Configuração do MyHomeLab. Edita com:  myhomelab-config
# (abre este ficheiro e reinicia o backend se houver alterações)

NODE_ENV=production
HOST=127.0.0.1
PORT=${BACKEND_PORT}
TZ=${TZ_NAME}

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

# Endereço por onde se abre a app (com https, o cookie de sessão fica "secure").
FRONTEND_URL="${APP_URL}"

JWT_SECRET="$(random_secret 48)"

# ⚠ NÃO ALTERAR: cifra os tokens do Google e a password do Nextcloud guardados na
# base de dados. Se mudar, todas as contas ligadas deixam de abrir e têm de ser
# religadas. Guarda uma cópia (está também em ${CREDS_FILE}).
TOKEN_ENCRYPTION_KEY="$(random_secret 32)"

# Google (Gmail e Tasks) — regista este redirect URI na consola do Google Cloud.
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="${APP_URL}/api/connected-account/google/callback"

EOF
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# --- build e base de dados -----------------------------------------------------------

build_app
migrate_db
publish_frontend

# --- serviço systemd e nginx (lib.sh) -----------------------------------------------

# Os scripts que o root corre (units, cron, myhomelab-*) vão para uma pasta só dele: o
# repo é do utilizador da app.
refresh_root_scripts "$SCRIPT_DIR"
configure_service
configure_updater
restart_backend
configure_nginx
# A versão instalada que a app mostra e de onde o myhomelab-update parte (ver update.sh).
as_app git -C "$APP_DIR" rev-parse HEAD | write_state_file installed-commit

# --- comandos de manutenção e backups ------------------------------------------------

msg "Installing the myhomelab-update, myhomelab-config and myhomelab-restore commands…"
install_commands
configure_backup_cron
systemctl enable --now cron >/dev/null
# Instalação antiga: os pedidos e o estado passaram para $UPDATES_DIR.
if [ -d "$LEGACY_UPDATES_DIR" ] && [ ! -L "$LEGACY_UPDATES_DIR" ]; then
  as_app rm -rf "$LEGACY_UPDATES_DIR" || true
fi

# --- primeiro utilizador ------------------------------------------------------------

# Direto na base de dados (create-admin.cjs) e não por POST /auth/register: quem instala
# pode escolher uma password com menos de 8 caracteres, que o registo recusa. Sem
# password escolhida, é gerada uma aleatória (mostrada uma vez no fim e guardada só em
# $CREDS_FILE).
USERS="$(runuser -u postgres -- psql -d "$DB_NAME" -tAc 'SELECT count(*) FROM "User"')"
ADMIN_CREATED=""
if [ "$USERS" = "0" ]; then
  msg "Creating the ${ADMIN_USERNAME} account (ADMIN)…"
  [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random_secret 15 | tr '+/' '-_')"
  load_env
  # A password vai pelo stdin e não pela linha de comandos (que o ps mostra).
  if printf '%s' "$ADMIN_PASSWORD" | ( cd "$APP_DIR/apps/backend" && as_app env -u ADMIN_PASSWORD \
        DATABASE_URL="$DATABASE_URL" ADMIN_USERNAME="$ADMIN_USERNAME" \
        node "$SCRIPT_DIR/create-admin.cjs" ); then
    ADMIN_CREATED="yes"
  else
    warn "Could not create the ${ADMIN_USERNAME} account."
  fi
fi

# --- credenciais --------------------------------------------------------------------

if [ -n "$ADMIN_CREATED" ] || [ ! -f "$CREDS_FILE" ]; then
  load_env
  {
    echo "MyHomeLab — credentials generated at install time ($(date '+%Y-%m-%d %H:%M'))"
    echo
    echo "App:                  ${APP_URL}"
    [ -n "$ADMIN_CREATED" ] && echo "User:                 ${ADMIN_USERNAME}"
    [ -n "$ADMIN_CREATED" ] && echo "Password:             ${ADMIN_PASSWORD}"
    echo
    echo "Database:             ${DATABASE_URL}"
    echo "TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY}   (never change it)"
  } > "$CREDS_FILE"
  chmod 600 "$CREDS_FILE"
fi

# --- resumo -------------------------------------------------------------------------

cat <<EOF

$(printf '\033[1;32m')MyHomeLab installed.$(printf '\033[0m')

  App:            ${APP_URL}
$( [ -n "$ADMIN_CREATED" ] && printf '  User:           %s\n  Password:       %s\n' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
  Credentials:    ${CREDS_FILE}   (root only)
  Configure:      myhomelab-config     (edits ${ENV_FILE} and restarts)
  Update:         myhomelab-update     (git pull, build, migrations, restart)
  Logs:           journalctl -u ${SERVICE} -f
  Backups:        ${BACKUP_DIR}   (daily at 03:30)

$( [ -n "$ADMIN_CREATED" ] && printf '  \033[1;33mWrite the password down: it is not shown again (a copy stays in %s).\033[0m\n\n' "$CREDS_FILE")
$( [ -n "$ADMIN_CREATED" ] && [ "${#ADMIN_PASSWORD}" -lt 12 ] && printf '  \033[1;33m⚠ The admin password is weak. Change it in the app before exposing it to the internet.\033[0m\n\n')
  Still to configure (myhomelab-config):
    - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for Gmail and Tasks;
      redirect URI to register with Google: ${APP_URL}/api/connected-account/google/callback
  Each user adds their own AI key (Settings → AI) and Proxmox servers
  (Settings → Servers) in the app.

EOF
