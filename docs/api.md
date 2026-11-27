# HTTP API

The backend has **no global prefix**: routes live at the root (`/auth/login`). In
development the base URL is `http://localhost:3100`; in production nginx serves the API
under `/api/…` and strips the prefix before proxying.

## Authentication and conventions

- **Session**: `POST /auth/login` sets an httpOnly `access_token` cookie (JWT, 7 days,
  `sameSite: strict`, `secure` when served over HTTPS). Clients send it with
  `credentials: 'include'` / `withCredentials: true`.
  The JWT carries `aud: "session"` and the user's `tokenVersion` (`ver`); every request
  re-reads the user from the database (role included) and rejects the token if the user is
  gone or the version changed. Logging out bumps `tokenVersion`, ending that user's sessions
  on every device. Other JWTs signed with the same secret (the Google OAuth `state`, with
  `aud: "google-oauth-state"`) are rejected as sessions.
- **Personal API tokens**: instead of the cookie, a client can send
  `Authorization: Bearer mhl_…` with a token created in Settings → API access. Only its
  SHA-256 hash is stored; the token is shown once. A `READ` token only passes `GET`/`HEAD`;
  a `FULL` token does what the user does on the site, except `/api-tokens` (always
  refused) and writes under `/auth` and `/user`. Tokens may expire (1–365 days) and are
  revoked from the same card. Routes marked **JWT** accept either.
- **Login throttle**: 5 failed logins per client IP and username in 15 minutes, or 30 per
  username from any IP in 5 minutes, return **429**. Behind a reverse proxy set
  `TRUSTED_PROXIES` so the client IP is the real one (see [deployment](deployment.md)).
- **Guards**: unless noted, every route requires a valid session (**JWT**). Routes marked
  **ADMIN** also require the admin role. Routes marked **public** need no session.
- **Ownership**: resources belong to a user; another user's resource returns **404**.
- **Validation**: request bodies are validated by DTOs; unknown fields are stripped.
- **Errors**: 400 invalid input · 401 no/expired session · 403 wrong role · 404 not found or
  not yours · 409 conflict · 412 AI not configured (`AI_KEY_MISSING` / `AI_KEY_INVALID`) ·
  429 AI subscription limit (`AI_RATE_LIMITED`) · 502 an external system failed ·
  503 AI unavailable or updates disabled. Many errors include a machine-readable `code`.
- **Streams**: routes marked **SSE** are Server-Sent Events.
- Route order matters in Nest: literal routes (`reorder`) are declared before `:id`.

The frontend mirrors these paths in `apps/frontend/src/Service/endPoints.ts`; add new routes
there too.

---

## Health check

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | public | Returns `"Hello World!"`; used as a health check |

## Auth · `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create the first user (becomes ADMIN); 403 once any user exists |
| POST | `/auth/login` | public (credentials) | Log in; sets the session cookie |
| POST | `/auth/logout` | JWT | End the session: bumps `tokenVersion` (all of the user's sessions) and clears the cookie |
| GET | `/auth/me` | JWT | Current user `{ id, username, role }` |

## API tokens · `/api-tokens`

Session cookie only: a personal token cannot list, create or revoke tokens.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api-tokens` | session | The user's tokens `{ id, name, scope, prefix, lastUsedAt, expiresAt, createdAt }` |
| POST | `/api-tokens` | session | Create `{ name, scope: READ\|FULL, expiresInDays? }`; the response carries `token`, shown only this once |
| DELETE | `/api-tokens/:id` | session | Revoke (204) |

## Users · `/user`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/user/me` | JWT | Current user |
| GET | `/user` | ADMIN | List users |
| POST | `/user` | ADMIN | Create a user (public registration is closed after the first) |

## Service catalogue · `/category`, `/service`

| Method | Path | Purpose |
|---|---|---|
| POST | `/category` | Create a category (409 if the name exists) |
| GET | `/category` | List categories, ordered |
| GET | `/category/with-services` | Categories with their services |
| GET | `/category/:id` | One category |
| PATCH | `/category/reorder` | Reorder categories (must contain every id) |
| PATCH | `/category/:id` | Rename |
| DELETE | `/category/:id` | Delete (cascades to its services) |
| POST | `/service` | Create a service shortcut |
| GET | `/service` | List services |
| GET | `/service/:id` | One service |
| PATCH | `/service/reorder` | Reorder services within a category |
| PATCH | `/service/:id` | Update, or move to another category |
| DELETE | `/service/:id` | Delete |

## Connected apps · `/connected-account`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/connected-account` | JWT | List connected apps (optional `?provider=`); never returns secrets. Each account carries `appHost` and `appBaseUrl` (the address as saved, without any `user:password@`). The create (`POST /connected-account/<app>`) and `PATCH` routes return the same secret-free view. Creating an account that already exists (same address, and for Forgejo the same user) updates its credentials instead of returning 409, so its history and machine link are kept |
| GET | `/connected-account/google/connect` | JWT | Redirect to Google consent (`?kind=gmail\|tasks\|drive`) |
| GET | `/google-drive/:accountId/links` | JWT | Drive folders and files linked to projects (Jarvis only changes these) |
| POST | `/google-drive/:accountId/links` | JWT | Link a Drive folder or file (`target`: link or id) to a project |
| DELETE | `/google-drive/links/:id` | JWT | Remove a link |
| GET | `/connected-account/google/callback` | public | Google OAuth callback; authorised by a signed, short-lived `state` |
| POST | `/connected-account/nextcloud` | JWT | Connect a Nextcloud account |
| GET | `/connected-account/:id/nextcloud-status` | JWT | Nextcloud version, apps and app updates |
| POST | `/connected-account/forgejo` | JWT | Connect a Forgejo instance (token) |
| GET | `/connected-account/:id/forgejo-status` | JWT | Forgejo account, repositories and version |
| POST | `/connected-account/opengym` | JWT | Connect openGym with a pairing code |
| GET | `/connected-account/:id/opengym-status` | JWT | openGym profile, routines, workouts and version |
| POST | `/connected-account/trek` | JWT | Connect a TREK (travel planner) instance |
| GET | `/connected-account/:id/trek-status` | JWT | TREK settings, MCP status and version |
| PUT | `/connected-account/:id/trek-mcp` | JWT | Set or clear the TREK MCP machine client |
| PUT | `/connected-account/:id/opengym-mcp` | JWT | Set or clear the openGym MCP API token (`ogt_…`) |
| POST | `/connected-account/gametracker` | JWT | Connect GamesTracker Vault with a personal API token (`gtv_…`) |
| GET | `/connected-account/:id/gametracker-status` | JWT | GamesTracker user, shelf counts, hours, rating and version |
| POST | `/connected-account/immich` | JWT | Connect Immich with an API key |
| GET | `/connected-account/:id/immich-status` | JWT | Immich user, key permissions, photos, videos, disk, failed jobs, paused queues and version |
| POST | `/connected-account/paperless` | JWT | Connect Paperless-ngx with an API token |
| GET | `/connected-account/:id/paperless-status` | JWT | Paperless user and permissions, documents, inbox, disk, health problems, failed tasks and version |
| POST | `/connected-account/solidtime` | JWT | Connect solidtime with a personal API token (one organisation per connection) |
| GET | `/connected-account/:id/solidtime-status` | JWT | solidtime user, organisation and role, running timer, last 7 days, projects and clients |
| POST | `/connected-account/stirling` | JWT | Connect Stirling-PDF with an API key |
| GET | `/connected-account/:id/stirling-status` | JWT | Stirling-PDF operations (and how many are disabled), admin key, MCP tools and version |
| POST | `/connected-account/plane` | JWT | Connect Plane with a personal token and a workspace |
| GET | `/connected-account/:id/plane-status` | JWT | Plane user, workspace, edition, projects and version |
| POST | `/connected-account/gitea-mirror` | JWT | Connect Gitea Mirror with an API key |
| GET | `/connected-account/:id/gitea-mirror-status` | JWT | Gitea Mirror health, repositories by status, failures, MCP tools and version |
| POST | `/connected-account/jellyfin` | JWT | Connect Jellyfin with an API key |
| GET | `/connected-account/:id/jellyfin-status` | JWT | Jellyfin server, libraries, item counts, users, who is playing, pending restart and version |
| POST | `/connected-account/dispatcharr` | JWT | Connect Dispatcharr with an admin's API key |
| GET | `/connected-account/:id/dispatcharr-status` | JWT | Dispatcharr user, channel and stream counts, M3U accounts, EPG sources, live channels, clients and version |
| POST | `/connected-account/coolify` | JWT | Connect a Coolify instance (`baseUrl`, `apiToken`, optional `displayName` and location) |
| GET | `/connected-account/:id/coolify-status` | JWT | Current Coolify state: team, servers and unreachable ones, projects, resource counts, unhealthy resources, MCP tool count, version |
| POST | `/connected-account/nginx-proxy-manager` | JWT | Connect a Nginx Proxy Manager (`baseUrl`, `email`, `password`, optional `displayName` and location) |
| GET | `/connected-account/:id/nginx-proxy-manager-status` | JWT | Current state: user, host counts, disabled and nginx-error hosts, certificates and those expiring within 30 days, version |
| POST | `/connected-account/tplink-router` | JWT | Connect a TP-Link router (Archer) with the local management password (`baseUrl`, optional `username` — default `admin` —, `password`, optional `displayName` and location); detects the login scheme and reads the model and firmware |
| GET | `/connected-account/:id/tplink-router-status` | JWT | `{ connection, router, version }` (`connection.kind` and `router.kind`: `router` or `extender`; `router.repeater` is an extender's backhaul to the main router, `null` on a router): `connection.state` is `connected`, `disconnected` (session interrupted or router unreachable — not an error, retried every 5 minutes, `nextRetryAt`) or `failed` (password refused); `router` has firmware, WAN/LAN, CPU and memory, Wi-Fi networks, devices, ports, mesh, DHCP leases and reservations, port forwards and access control (`null` when not connected). `?force=1` tries right away |
| POST | `/connected-account/:id/tplink-router-action` | JWT | An action: `wifi`, `block`, `unblock`, `accessControl`, `reservationAdd`, `reservationDelete`, `portForwardAdd`, `portForwardDelete`, `wanRenew`, `reboot` → `{ ok, message, connection }` (`ok: false` = disconnected, not an error) |
| POST | `/connected-account/clickhouse` | JWT | Connect a ClickHouse (`baseUrl`, `username`, `password`, optional `displayName`, `serverConnectionId`, `guestVmid`) |
| GET | `/connected-account/:id/clickhouse-status` | JWT | Current ClickHouse status (user, uptime, databases, tables, rows, bytes, disk, running queries, version) |
| POST | `/connected-account/postgres` | JWT | Connect a PostgreSQL server (`host`, `port`, `database`, `username`, `password`, `ssl` = `off`/`on`/`no-verify`, optional `displayName`, `serverConnectionId`, `guestVmid`) |
| GET | `/connected-account/:id/postgres-status` | JWT | Current PostgreSQL status (user, superuser, database, SSL, uptime, connections/limit, standby, databases with sizes, version) |
| POST | `/connected-account/vaultwarden` | JWT | Connect a Vaultwarden (address + admin token) |
| GET | `/connected-account/:id/vaultwarden-status` | JWT | Users, invited/disabled/without 2FA, organizations, database and version |
| POST | `/connected-account/infisical` | JWT | Connect an Infisical (address + Machine Identity client ID and secret) |
| GET | `/connected-account/:id/infisical-status` | JWT | Projects and environments the identity sees, and whether an update is available |
| GET | `/connected-account/:id/trek-tools` | JWT | Tools exposed by TREK's MCP server |
| POST | `/connected-account/home-assistant` | JWT | Connect Home Assistant (admin token) |
| GET | `/connected-account/:id/home-assistant-status` | JWT | Entities, automations, pending updates and version |
| POST | `/connected-account/adguard` | JWT | Connect AdGuard Home |
| GET | `/connected-account/:id/adguard-status` | JWT | Protection, stats, filters and version |
| PUT | `/connected-account/:id/adguard-settings` | JWT | Set the filter refresh interval |
| POST | `/connected-account/:id/adguard-refresh-filters` | JWT | Refresh blocklists now |
| GET | `/connected-account/:id/cron-jobs` | JWT | The app's cron jobs (fixed tasks in code, no AI) with interval, last and next run |
| PUT | `/connected-account/:id/cron-jobs/:key` | JWT | `{ intervalMinutes, time?, options? }` (0 = off, 60, 360, 720, 1440, 10080; with 1440, `time` is the Lisbon `HH:mm` it runs at every day, `null` = 24 h after the last run) |
| POST | `/connected-account/:id/cron-jobs/:key/run` | JWT | Run a cron job now |
| GET | `/servers/:id/cron-jobs` | JWT | A Proxmox server's cron jobs (the disk almost full alert) |
| PUT | `/servers/:id/cron-jobs/:key` | JWT | `{ intervalMinutes, options? }` — the disk alert takes 0, 1, 5, 15, 30, 60 or 1440 minutes and its options |
| POST | `/servers/:id/cron-jobs/:key/run` | JWT | Run a server cron job now |
| GET | `/connected-account/:id/gmail-stats` | JWT | Inbox counts (threads) |
| GET | `/connected-account/:id/updates` | JWT | All tracked new versions of this app |
| PATCH | `/connected-account/:id` | JWT | Run frequency, proposal settings, where the app runs (server / guest) |
| DELETE | `/connected-account/:id` | JWT | Disconnect (soft delete; reconnecting revives it) |

## Gmail rules · `/connected-account/:accountId/email-rule`

| Method | Path | Purpose |
|---|---|---|
| POST | `…/email-rule` | Create a rule (conditions + actions) |
| GET | `…/email-rule` | List the account's rules |
| POST | `…/email-rule/run` | Run the rules now |
| PATCH | `…/email-rule/reorder` | Reorder rules |
| GET | `…/email-rule/:id` | One rule |
| PATCH | `…/email-rule/:id` | Update a rule |
| DELETE | `…/email-rule/:id` | Delete a rule |

## Proposed Gmail rules · `/connected-account/:accountId/email-rule-proposal`

| Method | Path | Purpose |
|---|---|---|
| GET | `…/email-rule-proposal` | Pending and recently decided proposals |
| POST | `…/email-rule-proposal/analyze` | Analyse unlabelled mail now and propose rules (needs AI) |
| POST | `…/email-rule-proposal/implement-all` | Turn every pending proposal into a rule |
| PATCH | `…/email-rule-proposal/:id` | Edit a proposal |
| POST | `…/email-rule-proposal/:id/implement` | Turn one proposal into a rule |
| POST | `…/email-rule-proposal/:id/dismiss` | Dismiss (won't be proposed again) |
| POST | `…/email-rule-proposal/:id/restore` | Bring a dismissed proposal back |

## Agents · `/agent`

| Method | Path | Purpose |
|---|---|---|
| GET | `/agent` | The user's agent team with live status (created on first call) |
| GET | `/agent/tools` | Tool catalogue: name, group, read/write |
| POST | `/agent` | Create an agent. With `template` (the key of a built-in agent, e.g. `infra`) it keeps the built-in instructions (empty `prompt`, or the same text) and, when free, the template's key, so the starter documents linked to that key find it |
| PATCH | `/agent/:id` | Update an agent (the CEO cannot be deactivated or re-parented) |
| DELETE | `/agent/:id` | Delete an agent (not the CEO); its reports move to its manager |
| GET | `/agent/access` | Per-agent access level for an app or server (`?type=APP\|SERVER&targetId=`) |
| PUT | `/agent/access` | Set an agent's access level (none / read / write, or reset) |
| GET | `/agent/permissions` | Assistant-wide denied permission areas |
| PUT | `/agent/permissions` | Save denied permission areas |
| GET | `/agent/logs` | Agent activity log (paged) |
| GET | `/agent/logs/stream` | **SSE** — new log lines |
| GET | `/agent/stream` | **SSE** — live activity of every agent, starting with a snapshot |

## Assistant · `/assistant`

| Method | Path | Purpose |
|---|---|---|
| GET | `/assistant/history` | Messages of the most recent conversation (`?limit=`) |
| GET | `/assistant/conversations` | List conversations |
| POST | `/assistant/conversations/task/:taskId` | Get or create the conversation of a board task |
| GET | `/assistant/conversations/:id/messages` | Messages of a conversation |
| PATCH | `/assistant/conversations/:id` | Rename a conversation |
| DELETE | `/assistant/conversations/:id` | Delete a conversation |
| POST | `/assistant/chat` | Send a message to Jarvis (JSON, or multipart with up to 5 `files`: PDF, Word, Excel, CSV, text, images; 20 MB each); returns the reply and the documents used |
| GET | `/assistant/files/:id` | A file sent in the chat (PDF and images open inline, the rest downloads) |
| POST | `/assistant/preview-style` | Re-answer the last question with draft instructions (no tools, nothing saved) |
| DELETE | `/assistant/history` | Delete all of the user's conversations |

## AI provider and usage · `/ai`

| Method | Path | Purpose |
|---|---|---|
| GET | `/ai/providers` | Both AI providers (`claude-code`, `claude-api`): which is in use, key hint and models |
| GET | `/ai/providers/claude-code/status` | Whether the Claude CLI is installed and signed in |
| PUT | `/ai/providers/claude-code` | Save a subscription token (tested first) |
| DELETE | `/ai/providers/claude-code` | Remove the token (falls back to the machine login) |
| GET | `/ai/providers/claude-code/models` | Models available to the subscription |
| PUT | `/ai/providers/claude-code/models` | Choose the main and agent models |
| PUT | `/ai/providers/claude-api` | Save an Anthropic API key (tested first) |
| DELETE | `/ai/providers/claude-api` | Remove the API key (back to Claude Code if it was in use) |
| GET / PUT | `/ai/providers/claude-api/models` | Models for the API provider |
| GET / PUT | `/ai/providers/:provider/models` | The same for either provider (`claude-code` or `claude-api`): the models to choose from, and save the main and agent models |
| PUT | `/ai/providers/:provider/active` | Put `claude-code` or `claude-api` in use |
| GET | `/ai/providers/routing` | Mixed mode: which provider runs each kind of work (`chat`, `study`, `install`, `schedule`, `delegation`) and the Claude Code concurrency limit |
| PUT | `/ai/providers/routing` | `{ mixed?, routes?: { chat?, study?, install?, schedule?, delegation? }, maxClaudeCodeRuns? (1–6) }`; what is left out stays as it was |
| GET | `/ai/usage` | Token usage and estimated cost for a month, by agent, source and day |
| PUT | `/ai/usage/budget` | Set or clear the monthly budget (alerts at 80% and 100%) |

## Internal (loopback only)

These routes refuse anything that does not come from the machine itself or that came
through nginx (`X-Forwarded-For` present).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/internal/mcp/:id` | per-run token | MCP (JSON-RPC) bridge through which a running agent calls MyHomeLab tools. A call still running after 20 s switches to an SSE response (a comment every 30 s, then the result as a `message` event) when the client accepts `text/event-stream` |
| GET | `/internal/mcp/:id` | — | Always 405 (no server-sent notifications) |
| POST | `/internal/terminal/session` | local terminal token | Session for the local read-only terminal (`npm run claude`) |

## Servers · `/servers`

| Method | Path | Purpose |
|---|---|---|
| GET | `/servers` | List the user's Proxmox servers (secrets never returned) |
| POST | `/servers` | Add a server (API token); tested before saving |
| PATCH | `/servers/:id` | Update a server (re-tested if the connection changes) |
| DELETE | `/servers/:id` | Remove a server (`?force=true` if monitors use it) |
| GET | `/servers/:id/check` | Connection check: version, nodes, guests |
| GET | `/servers/:id/guests` | VMs and containers |
| GET | `/servers/:id/dashboard` | Nodes, storages, guests and history (`?timeframe=`) |
| GET | `/servers/:id/disks` | Disk health (SMART, ZFS pools), read now |
| GET | `/servers/:id/updates` | Pending package and Proxmox VE updates per node |
| GET | `/servers/:id/commands` | History of SSH commands run by agents |
| POST | `/servers/:id/ssh` | Enable SSH: generate a key pair, returns the public key |
| PATCH | `/servers/:id/ssh` | Change SSH user or port |
| DELETE | `/servers/:id/ssh` | Disable SSH and delete the keys |
| GET | `/servers/:id/ssh/test` | Test the SSH connection |
| POST | `/servers/:id/ssh/host-key/reset` | Trust the server's new SSH host key (after a reinstall): forgets the stored fingerprint, the next connection stores the new one; returns the server |

SSH uses trust on first use: the first connection stores the server's host key fingerprint (`sshHostKey`, OpenSSH `SHA256:` format, and `sshHostKeyAt`, both in the server view); later connections with a different key are refused with a message saying so, until the key is trusted again. Changing the server's `host` also forgets the stored key.

## Service monitors · `/service-monitors`

| Method | Path | Purpose |
|---|---|---|
| GET | `/service-monitors` | List HTTP/TCP monitors |
| POST | `/service-monitors` | Create a monitor (tested immediately) |
| PUT | `/service-monitors/:id` | Update a monitor |
| DELETE | `/service-monitors/:id` | Delete a monitor and its notifications |
| POST | `/service-monitors/:id/check` | Check now |

## Backups · `/backups`

| Method | Path | Purpose |
|---|---|---|
| GET | `/backups/destinations` | List backup destinations (Nextcloud / WebDAV, or `LOCAL` — a folder on the server) |
| POST | `/backups/destinations` | Add a destination (tested) |
| PATCH | `/backups/destinations/:id` | Update a destination |
| DELETE | `/backups/destinations/:id` | Delete (409 while backups use it) |
| GET | `/backups/destinations/:id/check` | Test a destination; reports free space |
| GET | `/backups/jobs` | List MyHomeLab's own backup jobs with recent runs (connected apps no longer have backups here) |
| POST | `/backups/jobs` | Create a MyHomeLab backup job (admin); an `accountId` is rejected with 400 |
| PATCH | `/backups/jobs/:id` | Update a job (frequency, retention, options) |
| DELETE | `/backups/jobs/:id` | Delete a job (files already written stay) |
| POST | `/backups/jobs/:id/run` | Run a backup now |
| GET | `/backups/instance` | MyHomeLab backup settings: password set, restore available (admin) |
| PUT | `/backups/instance/password` | Set the backup password (min. 10 characters; admin) |
| POST | `/backups/instance/download` | Create a full backup and download it (password-protected `.zip`, one folder per area; admin) |
| POST | `/backups/instance/restore` | Upload a backup (`file`, `password`); checks it and asks the server to restore it (202; admin) |
| GET | `/backups/instance/restore/status` | Restore progress and log (admin) |

## Documents · `/docs`

| Method | Path | Purpose |
|---|---|---|
| GET | `/docs` | Document index with filters and search |
| GET | `/docs/targets` | Things a document can be linked to |
| GET | `/docs/linked` | Documents linked to a target (`?type=&targetId=`) |
| GET | `/docs/proposals` | Pending agent proposals, each with `changes` (title, section, links and tags it would change); `?conversationId=` keeps only those made in that chat conversation |
| POST | `/docs/proposals/:id/approve` | Approve a proposal (optionally edited); 409 while another approval of it is being applied |
| POST | `/docs/proposals/:id/reject` | Reject a proposal |
| GET | `/chat-approvals?conversationId=` | Pending chat cards of a conversation: an email to send, a team change or an update to install, waiting for the user's yes |
| POST | `/chat-approvals/:id/approve` | Approve a card: sends the email, applies the team change or puts the update in Ready to update (`status` FAILED with `result` when it fails) |
| POST | `/chat-approvals/:id/reject` | Reject a card |
| POST | `/docs/starter` | Create any missing starter documents (general rules, process docs, one rules doc per connected app) |
| GET | `/docs/sections` | The user's sections (`{ id, name, parentId, position }`) |
| POST | `/docs/sections` | Create a section (`{ name, parentId? }`) |
| PATCH | `/docs/sections/:id` | Rename or move a section (no cycles) |
| DELETE | `/docs/sections/:id` | Delete a section; its documents and subsections move up one level |
| POST | `/docs/maps/refresh` | Rebuild the generated maps of the user's servers and connected apps now (`{ written }`) |
| GET | `/docs/templates` | Template sets (installed and from the repository's `main`) |
| POST | `/docs/templates/:id` | Create the documents of a template set (skips existing titles) |
| POST | `/docs/:id/check-conflicts` | Compare a rules document with the other rules |
| GET | `/docs/:id` | One document with links, versions and conflicts |
| POST | `/docs` | Create a document |
| PATCH | `/docs/:id` | Update (previous version kept) |
| DELETE | `/docs/:id` | Delete |
| GET | `/docs/:id/versions/:versionId` | An older version |
| POST | `/docs/:id/versions/:versionId/restore` | Restore an older version |

## App updates · `/app-updates`

| Method | Path | Purpose |
|---|---|---|
| GET | `/app-updates/attempts` | Update attempts (study, preparation, verification) for an app or host |
| GET | `/app-updates/attempts/:id` | One attempt with every checked point and its evidence |
| GET | `/app-updates/finished` | What the clean-up would delete: finished updates (Done, Failed, Cancelled), their tasks and the logs only they use |
| DELETE | `/app-updates/finished` | Delete them, to start over (a version that was not installed shows up as available again) |
| GET | `/app-updates/setting` | Update workflow settings (board modules) |
| PUT | `/app-updates/setting` | Save update workflow settings |

The update lifecycle itself is driven by the board and the agents' tools; see
[App updates](./development/06-app-updates.md).

## Triggers (schedules) · `/schedules`

| Method | Path | Purpose |
|---|---|---|
| GET | `/schedules` | List agent triggers with their last runs |
| GET | `/schedules/summary` | "What the agents did" between two days |
| GET | `/schedules/:id` | One trigger with its runs |
| POST | `/schedules` | Create a trigger (once, daily, weekly, monthly) |
| PUT | `/schedules/:id` | Update a trigger |
| DELETE | `/schedules/:id` | Delete a trigger and its history |
| POST | `/schedules/:id/run` | Run now, in the background |

## Board (Projects) · `/board`

| Method | Path | Purpose |
|---|---|---|
| GET | `/board/attention` | What on the board is waiting for the user |
| GET | `/board/projects` | Projects with columns, modules and cycles (creates the updates project on first use) |
| POST | `/board/projects` | Create a project |
| PATCH | `/board/projects/:id` | Update a project |
| DELETE | `/board/projects/:id` | Delete a project and its tasks (not the updates project) |
| POST | `/board/projects/:id/states` | Add a column |
| PATCH | `/board/states/:id` | Update a column |
| DELETE | `/board/states/:id` | Delete an empty, non-system column |
| POST | `/board/projects/:id/modules` | Add a module |
| PATCH | `/board/modules/:id` | Update a module |
| DELETE | `/board/modules/:id` | Delete a module |
| POST | `/board/projects/:id/cycles` | Add a cycle |
| PATCH | `/board/cycles/:id` | Update a cycle |
| DELETE | `/board/cycles/:id` | Delete a cycle (tasks stay) |
| GET | `/board/tasks` | List/filter tasks |
| PATCH | `/board/tasks/bulk` | Apply the same change to many tasks |
| GET | `/board/tasks/:id` | One task with comments, links, activity, docs, triggers and update |
| POST | `/board/tasks` | Create a task |
| PATCH | `/board/tasks/:id` | Update a task (moving an update task changes the update's state) |
| DELETE | `/board/tasks/:id` | Delete a task |
| POST | `/board/tasks/:id/comments` | Comment (a user comment answers the task's open question) |
| POST | `/board/tasks/:id/links` | Add a link |
| DELETE | `/board/tasks/:id/links/:linkId` | Remove a link |
| POST | `/board/tasks/:id/docs` | Link a document |
| DELETE | `/board/tasks/:id/docs/:docId` | Unlink a document |
| POST | `/board/tasks/:id/relations` | Add a relation (blocks / relates / duplicates) |
| DELETE | `/board/relations/:id` | Remove a relation |
| POST | `/board/tasks/:id/attachments` | Upload an attachment (multipart, up to 10 MB) |
| GET | `/board/attachments/:id` | Download an attachment |
| DELETE | `/board/attachments/:id` | Delete an attachment |

## Tasks (to-dos) · `/todos`, `/todo-sync`

| Method | Path | Purpose |
|---|---|---|
| GET | `/todos/lists` | Lists with open counts |
| POST | `/todos/lists` | Create a list |
| PATCH | `/todos/lists/:id` | Rename, recolour or move a list |
| DELETE | `/todos/lists/:id` | Delete a list and its tasks |
| GET | `/todos` | List tasks (`?listId=&status=&search=`) |
| POST | `/todos` | Create a task or sub-task |
| PATCH | `/todos/:id` | Update a task |
| DELETE | `/todos/:id` | Delete a task and its sub-tasks |
| GET | `/todo-sync` | Sync settings, accounts and groups |
| PUT | `/todo-sync/setting` | Enable/disable sync and set the interval |
| GET | `/todo-sync/accounts/:id/lists` | Lists of a Google Tasks / Nextcloud account |
| POST | `/todo-sync/groups` | Create a sync group |
| PUT | `/todo-sync/groups/:id` | Update a sync group |
| DELETE | `/todo-sync/groups/:id` | Remove a sync group (no tasks are deleted) |
| POST | `/todo-sync/run` | Sync now |

## Notifications · `/notifications`

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Active and recently resolved notifications |
| GET | `/notifications/count` | Active count (menu badge) |
| DELETE | `/notifications/resolved` | Clear the resolved history |
| POST | `/notifications/:id/dismiss` | Mark an agent notice as seen |

## Today · `/today`

| Method | Path | Purpose |
|---|---|---|
| GET | `/today/shortcuts` | The Today shortcuts, in order |
| POST | `/today/shortcuts` | Add one: `{ kind: APP, accountId }`, `{ kind: EMAIL_RULES }`, `{ kind: LINK, label, url }`, `{ kind: HEALTH_FORM, formId }` or `{ kind: INTAKES }` (409 if that app, form, the email rules or the intakes are already there) |
| DELETE | `/today/shortcuts/:id` | Remove a shortcut |
| GET | `/today/weather` | `{ location, forecast }`: now and the next days from Open-Meteo (cached 15 min), or nulls without a city |
| PUT | `/today/weather` | `{ city }`: geocode it with Open-Meteo and save it (404 if not found) |
| DELETE | `/today/weather` | Forget the city |

## Health · `/health`

All health routes are per user. AI-assisted routes (lab/exam extraction, meal estimates)
send data to Anthropic using the user's own AI session and return 412 without one.

| Area | Routes | Purpose |
|---|---|---|
| Summary | `GET /health/summary` | Averages shown on the health page (including one entry per body metric in `metrics`) |
| Huawei import | `POST /health/import/huawei`, `…/heart`, `…/skin-temperature`, `…/blood-oxygen`, `…/stress`, `…/exercise`, `…/steps` | Import files from a Huawei Health export |
| Wearable data | `GET /health/sleep`, `/heart`, `/skin-temperature`, `/blood-oxygen`, `/stress`, `/steps` (+ `/:id` for each) | Daily series and per-day detail |
| Exercise | `GET /health/exercise`, `GET /health/exercise/types`, `POST /health/exercise/workouts`, `GET\|PUT\|DELETE /health/exercise/workouts/:id`, `GET …/:id/parts/candidates`, `PUT …/:id/parts`, `DELETE …/:id/parent`, `POST …/:id/sync`, `POST /health/exercise/sync` | Workouts, merging parts, openGym sync |
| Weight and water | `GET\|POST /health/weight`, `DELETE /health/weight/:id`, `GET\|POST /health/water`, `DELETE /health/water/:id` | Quick logs; a weigh-in is one measurement and can carry the body composition from the scale (BMI, body fat % and mass, subcutaneous and visceral fat, muscle % and mass, skeletal muscle % and mass, bone % and mass, fat-free weight, BMR, body water % and mass, protein % and mass) and a device |
| Body metrics | `GET|POST /health/metrics/:metric`, `DELETE /health/metrics/:metric/:id` | One body composition or tape measurement: period averages and the values, newest first; log a single value from its own page (as a new measurement or added to an existing one with `entryId`) or remove it |
| Devices | `GET\|POST /health/devices`, `PATCH\|DELETE /health/devices/:id` | Measuring machines by type (scale, blood pressure monitor, glucometer, thermometer, oximeter, other) with brand and model; one default per type, used by weigh-ins and vital readings |
| Quick forms | `GET\|POST /health/forms`, `PUT\|DELETE /health/forms/:id`, `POST /health/forms/:id/entries` | User-made forms with chosen fields (scale, tape measurements, water), shown as a grid or as an ordered list, filled in one go |
| Labs | `POST /health/labs/extract`, `GET\|POST /health/labs`, `GET /health/labs/parameters`, `GET /health/labs/parameters/:key`, `GET /health/labs/analytes`, `GET\|PUT\|DELETE /health/labs/:id`, `POST\|GET /health/labs/:id/pdf` | Lab reports (PDF read by AI; personal data not stored) |
| Profile and records | `GET\|PUT /health/profile`, `GET\|POST /health/conditions`, `PUT\|DELETE /health/conditions/:id`, `GET\|POST /health/medications`, `PUT\|DELETE /health/medications/:id`, `GET\|POST /health/diary`, `PUT\|DELETE /health/diary/:id` | Profile (including the chosen average tabs), allergies/conditions, medication, diary |
| Nutrition | `GET /health/nutrition`, `POST /health/meals/estimate`, `POST /health/meals`, `PUT\|DELETE /health/meals/:id`, `POST\|GET /health/meals/:id/photo` | Meals, AI estimates, photos |
| Body and vitals | `GET /health/body`, `PUT /health/body/measurements`, `DELETE /health/body/measurements/:id`, `POST /health/body/photos`, `GET\|DELETE /health/body/photos/:id`, `POST /health/vitals`, `DELETE /health/vitals/:id` | Measurements, progress photos, vital readings |
| Intakes | `GET\|POST /health/intakes`, `PUT /health/intakes/settings`, `POST /health/intakes/items`, `PUT\|DELETE /health/intakes/items/:id`, `PUT\|DELETE /health/intakes/:id` | Coffee and alcohol |
| Wellbeing | `GET /health/wellbeing`, `PUT\|DELETE /health/mood/:day`, `POST /health/habits`, `PUT\|DELETE /health/habits/:id`, `PUT /health/habits/:id/checks/:day`, `POST /health/fasts`, `PUT\|DELETE /health/fasts/:id` | Mood, habits, fasting |
| Medical | `GET /health/medical`, `POST\|PUT\|DELETE` on `/health/medical/appointments`, `/vaccines`, `/exams`, `/illnesses`, `/vision`, `/lenses` (`/:id` for update/delete), `POST /health/medical/exams/extract`, `POST\|GET /health/medical/exams/:id/pdf` | Appointments, vaccines, exams, illnesses, prescriptions, contact lenses (used by the assistant and reminders) |
| openGym | `GET /health/opengym`, `GET /health/opengym/status`, `POST /health/opengym`, `POST /health/opengym/app`, `PUT /health/opengym`, `POST /health/opengym/sync`, `DELETE /health/opengym` | openGym connection and workout sync |

## System · `/system` (ADMIN)

| Method | Path | Purpose |
|---|---|---|
| GET | `/system/status` | Uptime, memory, database check, scheduled jobs, recent warnings/errors |
| GET | `/system/version` | Installed version, latest release, whether an update is available |
| GET | `/system/releases` | Releases (tags) with their notes (`?refresh=1` fetches first) |
| POST | `/system/update` | Request an update to a newer `vX.Y.Z` (202; 409 if one is running; 503 in development) |
| GET | `/system/update/status` | Progress of the running/last update, with the log tail |

There is no route to downgrade: database migrations are not reversible.

## Android app · `/app`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/app/android` | JWT | `{ version, downloadUrl }` of the APK matching the installed server version |
| GET | `/app/android/download` | public | 302 redirect to that APK (404 if there is none) |
