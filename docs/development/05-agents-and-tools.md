# Agents and tools

Jarvis is not a single prompt: it is a **team of agents per user**, stored in the database
and run by one generic executor. This guide explains how a request flows and how to add
abilities.

## Where things live

| Path | What |
|---|---|
| `apps/backend/src/agent/` | Agent CRUD, templates (`agent-templates.ts`), tool catalogue (`tool-catalog.ts`), prompt composition, permissions and per-app access |
| `apps/backend/src/assistant/assistant.service.ts` | Entry point for a chat turn, triggers, installs and verifications |
| `apps/backend/src/assistant/agents/team-agent.ts` | `runTeamAgent` — the generic executor |
| `apps/backend/src/assistant/agents/agent-context.ts` | `AgentContext` — everything a tool can use for this turn |
| `apps/backend/src/assistant/agents/prompts/` | Built-in instructions for the template agents |
| `apps/backend/src/assistant/toolsets/` | Tool definitions grouped by toolset, and `toolbox.ts` |
| `apps/backend/src/assistant/tools/` | Tool implementations (plain functions) |
| `apps/backend/src/claude-code/` | Claude CLI runner and the local MCP bridge |

## The team

- Each `Agent` row has a key, name, description, `reportsToId`, model (`OPUS` → the main
  model, `SONNET` → the agent model), effort (`LOW` / `MEDIUM` / `HIGH`), instructions
  (`prompt`, `null` = the built-in text), user extras (`extraPrompt`), tools and an active flag.
- The agent with no manager is the **CEO (Jarvis)** — the only one that answers the user.
  It cannot be deleted, deactivated or given a manager.
- A new user gets only Jarvis. Other agents (administrative assistant, infrastructure
  engineer, Proxmox operator, smart-home engineer, doctor, health data scientist, personal
  trainer, travel agent) are templates the user can add on the Workflow page, or ask Jarvis
  to create with its team tools.

## How a turn runs

```
POST /assistant/chat
  └─ AssistantService.ask(user, message, conversation)
       ├─ load the team, denied permissions, AI client, documents
       └─ runTeamAgent(CEO, messages, context, depth = 0)
            ├─ compose instructions  (built-in/custom prompt + extras + team + documents)
            ├─ build the toolbox     (agent tools, in catalogue order, guarded)
            ├─ add ask_<key> per active subordinate
            └─ run the model; each ask_<key> → runTeamAgent(subordinate, …, depth + 1)
```

- **Delegation is a tool.** `ask_<key>({ request })` runs the subordinate with the full
  request (prefixed with the current date and time) and returns its report. Max depth 5.
- **The engine** is the user's AI provider — per kind of work in Mixed mode
  (`AiCredentialService.getClient(userId, work)`, works `chat | study | install | schedule |
  delegation`; subagents use `AiClient.delegate`). Claude Code runs wait for a turn in
  `claude-code/claudeCodeQueue.ts` (`inTurn`, per user, `AiRouting.maxClaudeCodeRuns`). With **Claude API** (`assistant/apiAgent.ts`) the
  backend runs a streaming tool loop on the Messages API (cached system prompt, sequential tool
  calls, failed tools returned as `is_error`); single-shot calls that force a tool are sent as
  structured outputs (`ai-credential/claudeApiClient.ts`). With **Claude Code** it is the Claude
  CLI (`claude -p`), run with a clean configuration: no user
  settings, plugins or built-in tools. The agent's tools are exposed through a local MCP
  bridge (`/internal/mcp/:id`, loopback only, per-run token). Tool errors return to the
  model as errors instead of failing the request.
- **Usage** (input, output, cache read/write tokens) is recorded per day, agent, model and
  source (`chat`, `schedule`, `study`, `install`, `verify`, `check`).
- **Docs used**: the documents listed in the request to read before acting, and any read with
  `docs_read`, are saved on the reply and shown under it.

### Prompt caching rule

The system prompt and tool list are a cached prefix. **Never put anything that changes
between turns (dates, ids, counters) into the instructions or the tool list** — it silently
destroys the cache. Variable state goes into the messages. This is also why tools are
always returned in catalogue order and why permissions are enforced in the handler, not by
removing tools.

### Instructions compose, never replace

`composeAgentPrompt` builds: the agent's instructions → the user's extra instructions
("follow them unless they contradict the rules above") → **YOUR TEAM** (subordinates) →
**WHO YOU REPORT TO** → the user's documents (the index only; the agent reads what it
needs with `docs_read`). An agent can change another agent's extra instructions only
through a two-turn proposal: propose in one turn, apply after the user says yes in the next — enforced in code by comparing turn ids.

## Tools and toolsets

A tool is an object with a name, description, JSON input schema and a handler:

```ts
export function buildTodoTools(context: AgentContext): AgentTool[] {
  return [
    {
      name: 'todo_lists',
      description: 'The user\'s task lists, with how many open tasks each has.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => todoLists(context),
    },
    // …
  ];
}
```

Toolsets: `email`, `server`, `serverControl`, `serverShell`, `health`, `forgejo`,
`homeAssistant`, `adguard`, `nextcloud`, `docs`, `updates`, `schedules`, `board`, `todos`,
`team` (plus `trek`, `opengym`, `gametracker`, `immich`, `paperless`, `solidtime`, `stirling`, `chatFiles` and others). `buildToolbox(names, context)` builds only the
toolsets an agent uses.

**Google Drive** (`drive`, Jarvis and the Archivist): search and read all of Drive, run exact
maths on Google Sheets (`drive_sheet_query`), compare versions to see which cells changed
(`drive_history`), and change cells, append rows, format sheets (`drive_sheet_format`: Sheets
tables, header, column types, dropdowns, conditional colours) and create files **only in folders or files linked
to a project** (`DriveLink`, checked in code by walking the parents). New folders can be created
anywhere (`drive_create_folder`, optionally linked to a project on creation), since a new folder
touches nothing that already exists; moving or linking existing files stays with the user. Jarvis
can also create a project on the board (`board_project_create`). What to do with each sheet
(which columns, how to match an existing row, what to update or add) lives in the project
documents, not in code.

**Chat files** (`chatFiles`, every agent): files sent in the chat are stored with the
conversation (`ChatFile`). In the message itself the PDF goes whole as a `document` block (text
plus page images) and images as `image` blocks; Word becomes Markdown (headings, lists, tables)
and spreadsheets (`.xlsx`, CSV) become tables with a profile of every column and the Excel row
numbers. `chat_file_query` does filters, sums, counts, group-bys and duplicates in code so the
numbers are exact; `chat_file_read` pages through rows or text; `chat_file_ask` sends a file whole
to the model with a question (PDFs and images, files from earlier messages, delegated work).

**TREK** reaches the agent one of two ways, by AI provider: with **Claude Code** the agent gets
TREK's own MCP server directly (`mcp__trek__*`, `trekDirect`); with the **Claude API** it uses the
MyHomeLab `trek_*` tools, which call the same MCP from the backend (the API cannot reach a TREK
on the home network).

**openGym** works the same way: with **Claude Code** and an openGym API token (`ogt_…`, set in
Apps → openGym → MCP) the agent gets openGym's own MCP server directly (`mcp__opengym__*`,
`openGymDirect`) and none of the `opengym_*` tools; with the **Claude API**, without the token or
with the MCP down, it uses the MyHomeLab `opengym_*` tools (the openGym REST API with the pairing
token). The pairing token is not accepted by openGym's `/mcp`.

**GamesTracker Vault** has no MCP: the `gametracker_*` tools (overview, shelf, IGDB search, game,
watchlist; set or remove a game, follow a price) call its REST API with the account's personal token
(`gtv_…`) on either provider. The **Games Curator** template (`games`, under Jarvis) has them; add it in
Workflow. `gametracker_set_game` merges with the current entry, because the API's `PUT` replaces the
whole entry.

**Immich** has no official MCP (only community servers), so the `immich_*` tools call its REST API
with the account's API key (`x-api-key`) on either provider: overview, search (smart search by
description, or by dates, place, people and favourites), albums, people, duplicates, job queues and
server settings (read); save an album (create, rename, add or remove photos), name or hide a person,
run, pause or resume a queue or start a manual job, and change settings (write). It never deletes
photos or albums. `immich_set_settings` merges the patch into the current `/system-config` and, without
`confirm`, only returns the before → after list. The **Photo Curator** template (`photos`, under
Jarvis) has them; add it in Workflow. Settings, queues and backups need an admin's key with the
`all` permission.

**Paperless-ngx** has no official MCP either: the `paperless_*` tools call its REST API with the
account's API token (`Authorization: Token …`): overview, search (full text and filters), read a
document (OCR text, notes, custom fields), tags/correspondents/types/storage paths/custom fields,
tasks, workflows and mail rules, and the application configuration (read); file a document (title,
tags, correspondent, type, path, date, ASN, note), the same change on many documents (`bulk_edit`,
needs `confirm`), create or change a tag/correspondent/type/path with its auto-matching, and change the
configuration (needs `confirm`, secrets are never shown or changed). It never deletes documents. Names
are resolved to ids. The **Archivist** template (`archivist`, under Jarvis) has them. Configuration
and system status need a superuser's token.

**solidtime** has no official MCP (a community one exists): the `solidtime_*` tools call its REST API
(`/api/v1`, `Authorization: Bearer` with a personal token). Each connection is one organisation (the
member id is stored in `username`). Overview, entries, report (aggregate by day/week/project/client/
task/tag…) and the catalogue (read); start and stop the timer, log or change an entry, and create or
change a project, client, task or tag (write). It never deletes. Times are taken and shown in the
user's time zone (from `/users/me`) and sent in UTC. The **Timekeeper** template (`timekeeper`) has
them. solidtime does not report its installed version, so it has no new-version alerts.

**Stirling-PDF** has an official MCP (`/mcp`, `X-API-KEY`), but it is in the paid (proprietary) part and
only answers when the server has `mcp.enabled`. So the base is its REST API: the `stirling_*` tools
read the operations from Stirling's own OpenAPI (`/v1/api-docs`), run any of them as multipart with
files taken from Paperless (`paperless_id`), Nextcloud (`nextcloud_path`) or an earlier result (kept 2
hours, for chaining), and save the output as a new Paperless document or Nextcloud file — never over the
original. Admin keys also read and change the server settings (`/api/v1/admin/settings`, preview first,
secrets refused). On Claude Code, when the MCP answers, it is also connected directly
(`stirlingDirect`, `mcp__stirling__*`, read-only tools only outside chat or with read access).

**Plane** (`plane`, Jarvis): projects, states, labels and work items through the v1 API (`X-API-Key`,
workspace slug stored per connection); search, create, update and comment. Plane Community has no
server-side MCP (the official one is a separate Python program), so only the `plane_*` tools exist.

**Gitea Mirror** (`giteaMirror`, Infrastructure Engineer): status, failures, activity, adding
repositories or organisations and running mirror, sync and retry jobs (`x-api-key`). Its own MCP
(`POST /api/mcp`, v3.46+) is also connected directly on Claude Code (`giteaMirrorDirect`,
`mcp__gitea_mirror__*`, read-only tools only outside chat or with read access).

**Jellyfin** (`jellyfin`, Jarvis): libraries, item search and details, sessions (who is watching, transcoding reasons), users, scheduled tasks and the activity log through the REST API with an API key sent as `Authorization: MediaBrowser Token="…"` (legacy `X-Emby-Token`/`api_key` auth is off by default since 10.11/12.0). Write tools scan libraries, refresh items, message/stop sessions, create/disable/delete users, run tasks, restart the server and create Jellyfin's own server-side backups (`/Backup`, 10.11+). Version comes from `/System/Info/Public`. Jellyfin has no server-side MCP.

**Dispatcharr** (`dispatcharr`, Jarvis): channels, streams, M3U accounts, EPG sources, live proxy connections and DVR recordings through the Django REST API with an admin's personal API key in `X-API-Key` (Dispatcharr v0.20+; almost every endpoint requires user level 10). Write tools edit channels (override-aware for auto-synced channels), create channels from streams, delete channels, refresh M3U/EPG, stop channels or clients, schedule/delete recordings and make Dispatcharr's own backups. Version comes from the unauthenticated `/api/core/version/`. Dispatcharr has no MCP.

**Coolify** (`coolify_*`, Infrastructure Engineer): connected with an API token from Keys & Tokens → API tokens (Bearer), against the v4 REST API at `/api/v1` (the API must be enabled in Settings → Advanced, and the MyHomeLab address must be allowed by Allowed IPs). Read tools give an overview (version, server reachability, projects and environments, unhealthy resources, running deployments), list and describe applications, services and databases, show a server's resources and domains, deployments and their logs, container logs and environment variable names (values only on request). Write tools — used only when asked — deploy by name, uuid or tag (optionally forcing a rebuild), start/stop/restart a resource and set an environment variable. Coolify also serves its own MCP at `/mcp` (Streamable HTTP, same token) when it is enabled for the instance and the token's team; in Claude Code it is attached directly to the agent, limited to the tools Coolify marks read-only (minus `get_env_values`) when the agent only has read access or runs on a schedule.

**Nginx Proxy Manager** (`nginx_proxy_manager_*`, Infrastructure Engineer): NPM has no API tokens, so it is connected with the email and password of a panel user (stored as `username` + encrypted `appPassword`, like AdGuard). The client logs in with `POST /api/tokens {identity, secret}`, keeps the JWT in memory, refreshes it with `GET /api/tokens` before it expires and logs in again on a 401; plain-http LAN addresses (e.g. port 81) are accepted. Users with two-factor login cannot be used. Read tools give an overview (version from `GET /api/`, host counts, disabled hosts and nginx errors, certificates expiring within 30 days), list proxy hosts, redirections, 404 hosts and streams, describe a proxy host, and list certificates, access lists (no passwords) and the audit log. Write tools — used only when asked — create and update proxy hosts (only the fields the API accepts; certificates must already exist), enable or disable any host, renew a Let's Encrypt certificate, and delete a proxy host (the agent confirms first). There is no MCP.

**ClickHouse** is reached over its HTTP interface (port 8123/8443, or an HTTPS proxy; a pasted `/play` URL is normalised), with the user and password sent in the `X-ClickHouse-User` / `X-ClickHouse-Key` headers. Reads (`clickhouse_overview`, `clickhouse_tables`, `clickhouse_describe`, `clickhouse_query`, `clickhouse_queries`, `clickhouse_health`) run with `readonly=2`, `max_result_rows` and a 60 s limit (falling back to plain reads for users whose profile is already readonly); `clickhouse_execute` and `clickhouse_kill` are write tools. The official ClickHouse MCP is a separate Python stdio program, so MyHomeLab uses its own tools instead. The version comes from `SELECT version()` and the latest release is the highest `-stable`/`-lts` tag on GitHub.

**PostgreSQL** is connected directly with the `pg` driver (host, port, database, user, password, SSL off/verified/unverified); the stored `baseUrl` is `postgres://host:port/db?sslmode=…` without the password, which is kept encrypted. Every tool call opens a short-lived client with `statement_timeout` and closes it. Reads (`postgres_overview`, `postgres_tables`, `postgres_describe`, `postgres_query`, `postgres_activity`, `postgres_maintenance`) never write: `postgres_query` runs inside `BEGIN READ ONLY` over the extended protocol (a single statement) with a row cap. `postgres_execute` and `postgres_cancel` are write tools. There is no MCP. The installed version comes from `SHOW server_version` and the latest from postgresql.org's `versions.json` (PostgreSQL has no GitHub releases).

**Vaultwarden** connects through the admin panel with the `ADMIN_TOKEN` (stored encrypted): MyHomeLab posts the token to `/admin`, keeps the `VW_ADMIN` session cookie for a few minutes and calls the panel's JSON routes. Vaults are end-to-end encrypted with each user's master password, so they are never read and no master password is ever asked for. Tools: `vaultwarden_overview`, `vaultwarden_users`, `vaultwarden_organizations`, `vaultwarden_config` (secrets masked) to read; `vaultwarden_invite`, `vaultwarden_user_action` (disable, enable, deauth, remove 2FA, resend invite), `vaultwarden_delete_user`, `vaultwarden_backup_db` (SQLite only) and `vaultwarden_test_smtp` to act. The installed version comes from `/api/version`.

**Infisical** connects with a Machine Identity using Universal Auth: the Client ID is stored in `apiClientId` and the Client Secret encrypted in `apiClientSecret`; MyHomeLab logs in at `/api/v1/auth/universal-auth/login`, caches the short-lived access token and logs in again when it expires. Secrets use `/api/v4/secrets` (falling back to `/api/v3/secrets/raw` on older servers) and folders `/api/v2/folders`. Tools: `infisical_overview`, `infisical_secrets` (names only unless `values: true`), `infisical_secret_get` and `infisical_folders` to read; `infisical_secret_set`, `infisical_secret_delete` and `infisical_folder_create` to write. The official Infisical MCP is a separate stdio program and is not used. Infisical does not expose the installed version, so there is no version tracking; the status shows `latestAvailableVersion` from `/api/v1/admin/config` when an update exists.

### Permissions (three layers)

| Layer | Where it is set | Enforced by |
|---|---|---|
| Tools | Workflow page (`Agent.tools`) | only assigned tools are built |
| Areas | Assistant → Settings → Permissions (read/write per area, for all agents) | `guardTools` + the tool's requirements |
| Apps / servers | each app or server page → Agents (none / read / write per agent) | `appAccessBlock` |

A blocked call returns a "no permission" message the model can explain to the user.

### Adding a tool

1. Implement the logic as a plain function in `assistant/tools/` (reuse module helpers
   where possible).
2. Add the tool to a toolset in `assistant/toolsets/` (or create a new toolset and register
   it in `toolsets/toolbox.ts`).
3. Register it in `agent/tool-catalog.ts`: name, toolset, group, `read` or `write`, and the
   short status line shown on the Workflow page while it runs.
4. Declare its permission area in `agent/helpers/assistantToolPermissions.ts`; if the
   toolset targets a connected app, map it in the app-access targets.
5. If template agents should get it, add it to `agent-templates.ts`. Existing teams keep
   their tool lists; users add it on the Workflow page (or ship a migration).
6. Write tool descriptions as instructions for the model: when to use it, what the inputs
   mean, what it returns.

## Rules live in documents

Behaviour that should be configurable (what needs approval, which commands are
destructive, how to update a given app) belongs in the user's **documents**, not in code
or prompts. The documents linked to an agent and to what it is working on are listed at
the end of the request, and the tools that change things wait until those are read with
`docs_read`. Agents propose changes to user documents and the user approves them — the text,
or only the arrangement (`docs_propose` `organize`: title, links, tags, section, including a new
section). `docs_layout` shows agents the Documents page exactly as the user sees it (the user's
sections, then "Servers and apps", "Projects" and "General" — the rule lives in
`docAutoGroup` in `@myhomelab/shared`, used by the page too), and `docs_targets` lists what a
document can link to, with ids. The code
measures, executes and records — the agents, following the rules, are the brakes.

For example, server shell commands run as soon as an agent calls them; the code only
classifies them as read or write for the log and takes a snapshot of a machine before a
command that changes it. The list of forbidden commands is in the server rules document.

## Triggers

`agent-schedule/` runs agent jobs: once, daily, weekly, monthly, or on a new update
(`ON_NEW_UPDATE`). A trigger names an agent and an instruction; the result can notify the
user or open a new conversation (`toChat`). Agents can create and edit triggers with the
`schedules` toolset.
