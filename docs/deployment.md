# Deployment

MyHomeLab installs as **one Proxmox LXC container** — no Docker. A script on the Proxmox
host creates a Debian 13 container and installs everything inside it.

```
┌──────────────────────── CT (Debian 13, unprivileged) ────────────────────────┐
│                                                                              │
│   nginx :80 ──┬── /        → /var/www/myhomelab   (frontend build)           │
│               └── /api/*   → 127.0.0.1:3000       (backend, systemd)         │
│                                    │                                         │
│                              PostgreSQL (localhost only)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## What the container contains

| Piece | Location |
|---|---|
| Node.js 22 | official tarball, installed to `/usr/local` |
| Code | `/opt/myhomelab` (git clone, owned by the `myhomelab` user) |
| Configuration | `/etc/myhomelab/myhomelab.env` |
| Backend service | `myhomelab.service` (systemd, `node dist/src/main.js`, listens on `127.0.0.1:3000`) |
| Frontend | `/var/www/myhomelab`, served by nginx |
| Database | local PostgreSQL, database and user `myhomelab` |
| Backups | `/var/backups/myhomelab` — daily at 03:30 and before every update, kept 14 days |
| Generated credentials | `/root/myhomelab-credentials.txt` |
| AI | the Claude CLI (`claude`), used by the agents |

nginx serves the frontend and proxies `/api/` to the backend, stripping the prefix, with
buffering disabled and a long read timeout so the live agent stream (SSE) works.
`index.html` is never cached; hashed assets are cached immutably.

## Scripts (`deploy/proxmox/`)

| Script | Runs on | What it does |
|---|---|---|
| `ct-create.sh` | Proxmox host | Asks for the settings, creates the CT, clones the repo and runs `install.sh` inside it |
| `install.sh` | inside the CT | Packages, Node, PostgreSQL, environment file and secrets, build, migrations, systemd units, nginx, backup cron, first admin user. Safe to re-run: existing config, secrets and data are kept |
| `update.sh` (`myhomelab-update`) | inside the CT | Fetch, checkout, `npm ci`, build, database dump, migrations, publish frontend, rewrite units and nginx, restart — with rollback |
| `backup.sh` | cron, 03:30 | `pg_dump` to `/var/backups/myhomelab`, 14 days of retention |
| `restore.sh` (`myhomelab-restore`) | inside the CT | Restores a full MyHomeLab backup (`.zip`), with rollback; also run by `myhomelab-restore.path` when a restore is requested from the app |
| `config.sh` (`myhomelab-config`) | inside the CT | Menu to edit the settings; `--raw` opens the file in an editor |

## 1. Create and install

On the **Proxmox host shell** (Datacenter → node → Shell):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/MyHomeLab/main/deploy/proxmox/ct-create.sh)"
```

A menu offers:

- **Default settings** — next free CT id, first active storage, 16 GB disk, 2 CPUs, 2 GB
  RAM, DHCP, host DNS, app address `http://<CT IP>`, branch `main`.
- **Advanced settings** — CT id and hostname, storages, disk/CPU/RAM/swap, bridge, DHCP
  or static IP (with gateway and optional VLAN), DNS, start on boot, the app address (CT IP
  or your own domain), the admin username/password, and the branch.

A review screen lets you create, edit or cancel before anything is created.

Unattended install: set `NONINTERACTIVE=1` plus any of the variables listed at the top of
`ct-create.sh`, for example:

```bash
NONINTERACTIVE=1 NET_MODE=static IP=192.168.1.50/24 GATEWAY=192.168.1.1 \
  APP_URL=https://myhomelab.example.com \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/MyHomeLab/main/deploy/proxmox/ct-create.sh)"
```

**The initial user is `admin` / `admin` unless you chose otherwise. Change the password
before exposing the app.** After the first user, public registration is closed; new
accounts are created in the Admin panel.

## 2. Domain, TLS and reverse proxy

Point your reverse proxy (Nginx Proxy Manager, Caddy, Traefik…) at the container:
`myhomelab.example.com` → `http://<CT IP>:80`, with TLS. Enable **WebSocket / long-lived
connection support**: the live agent view keeps a streaming connection open, and buffering
must be off. Raise the proxy read timeout too (Nginx Proxy Manager: Advanced →
`proxy_read_timeout 15m; proxy_send_timeout 15m;`): a request where Jarvis delegates work can take
several minutes. With a shorter timeout nothing is lost — the question is saved at once and the page
picks the reply up from the history when it is ready — but the answer only shows up later.

`APP_URL` must be the address users open. It is the Google OAuth return address and decides
whether the session cookie is `secure` (HTTPS only). If you change it later, update
`FRONTEND_URL` and `GOOGLE_OAUTH_REDIRECT_URI` with `myhomelab-config`.

## 3. Configure

Inside the CT (`pct enter <CT id>`):

```bash
myhomelab-config
```

The menu lists each setting with its current value (secrets masked). The database URL,
`JWT_SECRET` and `TOKEN_ENCRYPTION_KEY` are not shown.

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail and Google Tasks. Register `<APP_URL>/api/connected-account/google/callback` as the redirect URI |

> **Never change `TOKEN_ENCRYPTION_KEY`** once accounts are connected. It encrypts every
> stored token and password; with a different key none of them can be read again.

Everything else (Proxmox servers, connected apps, backup destinations) is configured per
user inside the app. The in-app **Help** page has step-by-step guides for each
integration.

### AI (Claude)

The installer installs the Claude CLI. Sign it in once, either inside the CT as the service
user:

```bash
runuser -u myhomelab -- env HOME=/var/lib/myhomelab claude auth login
```

or by creating a token on a machine with a browser (`claude setup-token`) and pasting it in
**Settings → AI**. **Verify** there must show "Connected".

Alternatively, each user can paste an Anthropic API key (pay as you go) in **Settings → AI**
and choose **Claude API** — no CLI sign-in needed.

## 4. Updating

### From the app (admin)

**Admin → Version** shows the installed version and the latest release; **Versions** lists
every release with its notes. You can update to any **newer** version (skipping versions is
safe; all migrations run). Going back is not allowed. A dialog shows progress and reloads
the page at the end.

How it works:

1. The backend runs unprivileged. It only writes the requested version to
   `/var/lib/myhomelab/updates/request`.
2. A root systemd **`.path` unit** (`myhomelab-updater.path`) notices the file and starts
   `myhomelab-updater.service`, which runs `update.sh --from-request`.
3. The script writes progress to `status.json` and output to `update.log` in the same
   folder, and runs one update at a time. Steps: fetch, build, dump, migrate, publish,
   configure, restart.
4. **Rollback**: if any step fails, it restores the database from the pre-update dump (if
   migrations had started), checks out the previous version, rebuilds and restarts — the
   app keeps running on the version it had.

The updater is protected against the OOM killer so that, under memory pressure, the kernel
kills the backend (restarted by the rollback) rather than the update itself.

PostgreSQL is protected too: a systemd drop-in (`postgresql@.service.d/myhomelab.conf`)
sets `OOMScoreAdjust=-900` and `Restart=on-failure`, and the backend unit has
`OOMScoreAdjust=500` and `OOMPolicy=continue`. Each Claude Code process the backend starts
raises its own score to 1000, so under memory pressure the kernel kills one agent run (that
request fails with an error) instead of the whole backend. An update study interrupted by a
restart counts as a failed attempt and is retried once, 3 hours later, so a study that
exhausts memory cannot put the backend in a restart loop. With several agents at once, 2 GB
is tight: 4 GB of RAM is recommended. The pre-update dump and the daily backup start a stopped cluster
before dumping instead of failing.

Logs: `journalctl -u myhomelab-updater`.

### From the console (inside the CT)

```bash
myhomelab-update             # latest release (tag vX.Y.Z)
myhomelab-update v1.4.0      # a specific release
myhomelab-update develop     # a branch (testing)
FORCE=1 myhomelab-update     # rebuild even if nothing changed
```

Before migrations, the database is dumped to
`/var/backups/myhomelab/myhomelab-<date>-before-update.sql.gz`.

> **Note on v2.0.0:** updating to v2.0.0 (or across it) runs a one-time `fresh_start`
> migration that empties every table except users, AI credentials and the exercise
> catalogue. Keep a copy of the pre-update dump if you need the old data.

## 5. Maintenance

```bash
journalctl -u myhomelab -f                       # backend logs
systemctl status myhomelab nginx postgresql
/opt/myhomelab/deploy/proxmox/backup.sh          # back up now
gunzip -c /var/backups/myhomelab/<file>.sql.gz | runuser -u postgres -- psql -d myhomelab   # restore
```

A Proxmox `vzdump` of the container is useful too, but a snapshot taken while PostgreSQL is
running is not always consistent — the daily dump is what guarantees the database.

### Full MyHomeLab backups (Admin → Backup)

A full backup is a password-protected `.zip` (AES-256), `myhomelab-<date>.zip`, that opens
as a folder with one subfolder per area: `agentes/`, `documentos/`, `projetos/`, `tarefas/`,
`apps-ligadas/`, `ia/`, `servidores/`, `servicos/`, `email/`, `saude/`, `disparos/`,
`notificacoes/`, `backups/`, `utilizadores/`, … Every database table goes whole into a
`.jsonl` file (one JSON record per line) in its area's folder — a table with no folder yet goes
to `outros/`, so nothing is left out. Documents (`documentos/leitura/`, by section) and agent
prompts (`agentes/*.md`) are also written as Markdown, to read. `manifest.json` lists the
tables, rows and columns; `LEIA-ME.txt` explains the folders; `_restauro/chaves.env` holds the
keys that make the stored logins readable (`TOKEN_ENCRYPTION_KEY`, `JWT_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). The export runs in one read-only snapshot
transaction and needs no `pg_dump`. Open it with 7-Zip, WinRAR or macOS using the **backup
password** set in Admin → Backup (Windows Explorer alone does not open AES zips). Without that
password a backup cannot be restored.

- **Download:** Admin → Backup → *Create and download*.
- **Scheduled:** add a backup job in the same section, to a Nextcloud destination or to
  *This server* (a `LOCAL` destination: a folder on the CT, `BACKUP_LOCAL_DIR`, by default
  `/var/lib/myhomelab/myhomelab-backups`). With frequency and retention.
- **Restore from the app:** Admin → Backup → *Restore a backup* (file, password, type
  `REPOR`). The backend opens the zip with the password and checks it (a backup from a newer
  version than the installed one is refused), leaves it and the password in
  `$SYSTEM_UPDATES_DIR/restore/` and writes `restore-request`; `myhomelab-restore.path` runs
  `restore.sh --from-request` as root.
- **Restore from the console** (also how you move to a new CT: install, then restore):

```bash
myhomelab-restore /root/myhomelab-2026-11-17_030000.zip   # asks for the password
```

`restore.sh` checks the zip, dumps the current database (`…-before-restore.sql.gz`) and copies
the environment file, stops the backend, and loads the data with
`node apps/backend/dist/src/cli/backup-tool.js import`: in one transaction, with the foreign
keys made deferrable while loading, it empties every table and inserts the `.jsonl` rows
(`json_populate_recordset`; columns that no longer exist are skipped, new ones get their
default), then resets the sequences. It then merges the keys into
`/etc/myhomelab/myhomelab.env`, runs the migrations and starts the backend. If a step fails, it
puts the previous database and environment file back. Everyone signs in again afterwards. Not
included: the Claude Code session stored on the server (sign in again in Settings → AI).

## Network notes

- Service monitors and integrations are called **from the container**, not from the
  browser: the CT must reach the addresses you register (LAN, VLANs, firewall).
- There is no ICMP ping (the CT is unprivileged); monitors use HTTP(S) or a TCP port.
- The installer sets the container's time zone to `Europe/Lisbon`; several schedules (the
  daily summary, health reminders, "today" in email searches) currently use Lisbon time.
