#!/usr/bin/env bash
# myhomelab-update — installs a release (or a branch) and runs it: fetch, checkout,
# dependencies, build, migrations, frontend, systemd units, nginx, restart.
#
# Usage (inside the container, as root):
#   myhomelab-update               # the latest release (vX.Y.Z tag)
#   myhomelab-update v1.4.0        # a specific release
#   myhomelab-update develop       # a branch (testing)
#   FORCE=1 myhomelab-update       # rebuild even if nothing changed
#
# The app's "Update" button writes the version to $REQUESTS_DIR/request; a systemd
# .path unit then runs this script (the root copy in $ROOT_LIB) with --from-request.
# Progress goes to $STATE_DIR/status.json (read by the app) and the output to
# $STATE_DIR/update.log.
#
# Root never runs the scripts in the repo, which belongs to the app user: after the
# checkout, stage 1 copies the new scripts to a folder of root's and runs stage 2 from
# there; the configure step installs that copy in $ROOT_LIB.
#
# Before the migrations the database is dumped to /var/backups/myhomelab. If a step
# fails, the previous version is checked out, rebuilt and restarted (and, if the
# migrations had already started, the database is restored from that dump), and the
# units, nginx site and root scripts go back to what they were, so the app keeps
# running on the version and the data it had.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"
export npm_config_update_notifier=false PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$APP_DIR"

json() { # escapes a string for JSON
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/}"
  printf '"%s"' "$s"
}

# status STATE STEP MESSAGE — written atomically; the app polls it.
status() {
  local finished=null body
  case "$1" in success|failed) finished="$(json "$(date -Is)")" ;; esac
  body="$(
    printf '{"state":%s,"target":%s,"from":%s,"step":%s,"message":%s,' \
      "$(json "$1")" "$(json "${TARGET_LABEL:-}")" "$(json "${FROM_LABEL:-}")" "$(json "$2")" "$(json "$3")"
    printf '"startedAt":%s,"finishedAt":%s}' "$(json "${STARTED_AT:-}")" "$finished"
  )"
  printf '%s\n' "$body" | write_state_file status.json
  # The update that moves an older install to the new layout: until the restart, the
  # running backend still reads the old folder. Written as the app user, which owns it.
  if [ -n "${LEGACY_STATUS:-}" ]; then
    printf '%s\n' "$body" | as_app sh -c 't="$(mktemp "$1.XXXXXX")" && cat > "$t" && chmod 644 "$t" && mv -f "$t" "$1"' \
      sh "$LEGACY_STATUS" 2>/dev/null || true
  fi
}

installed_label() { # vX.Y.Z when HEAD is a release, else the short commit
  as_app git describe --tags --exact-match --match 'v*' HEAD 2>/dev/null || as_app git rev-parse --short HEAD
}

# ======================================================================================
# Stage 1 — work out the target, check it out, copy the *new* scripts to a folder of
# root's and run stage 2 from there: the checkout may have changed lib.sh or this file.
# ======================================================================================
if [ "${MYHOMELAB_STAGE:-1}" = 1 ]; then
  ensure_update_dirs

  # One update (or restore) at a time; the lock is inherited by stage 2.
  exec 9>"$STATE_DIR/.lock"
  if ! flock -n 9; then
    # An app request while a restore runs: drop it (while it exists the .path unit keeps
    # re-triggering) and tell the app, unless it is our own update that is running.
    if [ "${1:-}" = "--from-request" ] && ! grep -q '"state":"running"' "$STATE_DIR/status.json" 2>/dev/null; then
      rm -f "$REQUESTS_DIR/request"
      STARTED_AT="$(date -Is)"
      status failed request "Another update or restore is running. Ask again when it finishes."
    fi
    die "Another update or restore is already running."
  fi

  TARGET="${1:-latest}"
  if [ "$TARGET" = "--from-request" ]; then
    request="$REQUESTS_DIR/request"
    [ -e "$request" ] || [ -L "$request" ] || exit 0
    # Read as the app user (it wrote it): a symlink there cannot make root read a file
    # of the system.
    TARGET=""
    if regular_file "$request"; then
      TARGET="$(as_app head -c 64 "$request" | tr -d '[:space:]' || true)"
    fi
    # Removed straight away: while it exists, the .path unit keeps re-triggering.
    rm -f "$request"
    if ! [[ "$TARGET" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      STARTED_AT="$(date -Is)"
      status failed request "Invalid update request: '$TARGET'"
      die "Invalid update request: '$TARGET'"
    fi
  fi

  start_state_log update.log

  STARTED_AT="$(date -Is)"
  FROM_LABEL="$(installed_label)"
  TARGET_LABEL="$TARGET"
  status running fetch "Fetching releases"
  # Only the checkout can have changed at this stage: put it back (a new tag left in
  # HEAD made the next try say "Already up to date" without building) and record it.
  set -E
  trap '[ -z "${BEFORE:-}" ] || as_app git checkout --quiet --force "$BEFORE" || true
    status failed fetch "Could not fetch or check out ${TARGET_LABEL} (see update.log)"' ERR
  trap '[ -z "${UPDATE_WORK:-}" ] || rm -rf "$UPDATE_WORK"' EXIT

  msg "Fetching from origin…"
  as_app git fetch --quiet --tags --force origin
  if [ "$TARGET" = latest ]; then
    TARGET="$(as_app git tag -l 'v*' --sort=-v:refname | head -1)"
    # No release yet: follow main.
    [ -n "$TARGET" ] || TARGET=main
  fi
  TARGET_LABEL="$TARGET"

  # What is really running: the commit of the last update that finished. HEAD is not
  # enough — an update cut off after the checkout (power loss) left it on the new tag
  # with the old build, and the next run would skip the build.
  BEFORE="$(as_app git rev-parse HEAD)"
  installed="$(head -c 64 "$STATE_DIR/installed-commit" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$installed" =~ ^[0-9a-f]{40}$ ]] && [ "$installed" != "$BEFORE" ] \
      && as_app git cat-file -e "$installed^{commit}" 2>/dev/null; then
    warn "The last update did not finish (code at $(as_app git rev-parse --short HEAD), last good install $(as_app git rev-parse --short "$installed")): building again."
    BEFORE="$installed"
    FROM_LABEL="$(as_app git describe --tags --exact-match --match 'v*' "$installed" 2>/dev/null || as_app git rev-parse --short "$installed")"
  fi
  if [[ "$TARGET" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    as_app git rev-parse -q --verify "refs/tags/$TARGET" >/dev/null \
      || { status failed fetch "Release $TARGET does not exist"; die "Release $TARGET does not exist."; }
    msg "Checking out release $TARGET…"
    as_app git checkout --quiet --force "refs/tags/$TARGET"
  else
    as_app git rev-parse -q --verify "refs/remotes/origin/$TARGET" >/dev/null \
      || { status failed fetch "Branch $TARGET does not exist"; die "Branch $TARGET does not exist."; }
    msg "Checking out branch $TARGET…"
    as_app git checkout --quiet --force "$TARGET" 2>/dev/null \
      || as_app git checkout --quiet --force -b "$TARGET" "origin/$TARGET"
    as_app git reset --quiet --hard "origin/$TARGET"
  fi

  UPDATE_WORK="$(mktemp -d /var/tmp/myhomelab-update.XXXXXX)"
  stage_root_scripts "$APP_DIR/deploy/proxmox" "$UPDATE_WORK/scripts"

  # exec does not run the EXIT trap: stage 2 cleans $UPDATE_WORK up.
  export UPDATE_WORK
  MYHOMELAB_STAGE=2 BEFORE="$BEFORE" TARGET_LABEL="$TARGET_LABEL" FROM_LABEL="$FROM_LABEL" \
    STARTED_AT="$STARTED_AT" exec bash "$UPDATE_WORK/scripts/update.sh"
fi

# ======================================================================================
# Stage 2 started by an older update.sh (installs from before the root copy): that one
# ran stage 1 from the repo, locked and logged in the old folder, and ran this file
# straight from the checkout. Set up the new layout and go on from a copy of root's.
# ======================================================================================
if [ -z "${UPDATE_WORK:-}" ]; then
  ensure_update_dirs
  # Replaces the old folder's lock (fd 9): from here on only the new one counts.
  exec 9>"$STATE_DIR/.lock"
  flock -n 9 || die "Another update or restore is already running."
  if [ -d "$LEGACY_UPDATES_DIR" ] && [ ! -L "$LEGACY_UPDATES_DIR" ]; then
    export LEGACY_STATUS="$LEGACY_UPDATES_DIR/status.json"
  fi
  # The output still reaches the old update.log too (stdout is the old stage's tee).
  start_state_log update.log
  msg "Moving the maintenance scripts and the update folders to the new layout…"
  UPDATE_WORK="$(mktemp -d /var/tmp/myhomelab-update.XXXXXX)"
  stage_root_scripts "$SCRIPT_DIR" "$UPDATE_WORK/scripts"
  export UPDATE_WORK
  exec bash "$UPDATE_WORK/scripts/update.sh"
fi

# ======================================================================================
# Stage 2 — build and switch to the new code; roll back if anything fails.
# ======================================================================================
trap 'rm -rf "$UPDATE_WORK"' EXIT
AFTER="$(as_app git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE:-}" != "1" ]; then
  msg "Already up to date (${TARGET_LABEL}). To rebuild anyway: FORCE=1 myhomelab-update"
  printf '%s\n' "$AFTER" | write_state_file installed-commit
  status success "done" "Already on $TARGET_LABEL"
  exit 0
fi

msg "Updating ${FROM_LABEL} → ${TARGET_LABEL}"
as_app git log --oneline "$BEFORE..$AFTER" 2>/dev/null | head -20 || true

# The units, the nginx site, the cron and $ROOT_LIB as they are now, for the rollback.
SNAPSHOT="$UPDATE_WORK/system.tar"
if ! snapshot_system "$SNAPSHOT"; then
  status failed configure "Could not save the current services before updating (see update.log)"
  die "Could not save the current services and scripts."
fi

STEP=""
MIGRATED=0
DB_DUMP=""
rollback() {
  local failed_step="$STEP" restored=true
  trap - ERR
  set +e
  warn "Step '$failed_step' failed — rolling back to $FROM_LABEL."
  status running rollback "Step '$failed_step' failed — restoring $FROM_LABEL"
  # As migrações já correram (ou começaram): a base de dados volta ao dump de antes.
  if [ "$MIGRATED" = 1 ] && [ -n "$DB_DUMP" ]; then
    restore_db "$DB_DUMP" || restored=false
  fi
  if $restored && as_app git checkout --quiet --force "$BEFORE" \
      && build_app && publish_frontend && restore_system "$SNAPSHOT" && restart_backend; then
    printf '%s\n' "$BEFORE" | write_state_file installed-commit
    status failed "$failed_step" "Update to $TARGET_LABEL failed at '$failed_step'. Still running $FROM_LABEL."
  else
    status failed "$failed_step" "Update failed at '$failed_step' and the rollback failed too. Check update.log."
  fi
  exit 1
}
set -E
trap rollback ERR

step() { STEP="$1"; status running "$1" "$2"; }

protect_from_oom

step build "Installing dependencies and building";   build_app
step dump "Saving the database";                      dump_db
MIGRATED=1
step migrate "Applying database migrations";          migrate_db
step publish "Publishing the frontend";                publish_frontend
step configure "Updating services and nginx"
configure_postgres
install_root_scripts "$UPDATE_WORK/scripts"
configure_service
configure_updater
configure_backup_cron
install_commands
configure_nginx
install_claude_code
step restart "Restarting the backend";                 restart_backend

trap - ERR
# Only now is the new version the installed one (the app reads it instead of HEAD).
printf '%s\n' "$AFTER" | write_state_file installed-commit
status success "done" "Updated to $TARGET_LABEL"
# The new backend reads the new folders; the old one is no longer needed.
if [ -n "${LEGACY_STATUS:-}" ]; then
  as_app rm -rf "$LEGACY_UPDATES_DIR" || warn "Could not remove $LEGACY_UPDATES_DIR."
fi
msg "Updated to $TARGET_LABEL."
