# Architecture

MyHomeLab is a single NestJS process with a PostgreSQL database, a React single-page app
served by nginx, and an Android app that talks to the same API. Everything runs inside one
Proxmox LXC container in production.

```
   Browser (React SPA)          Android app (React Native)
            │                              │
            │  httpOnly session cookie     │  same cookie, same API
            ▼                              ▼
   ┌───────────────────────────────────────────────────┐
   │ nginx :80   /      → static frontend build        │
   │             /api/* → backend (prefix stripped,    │
   │                      no buffering, for SSE)       │
   └───────────────────────────┬───────────────────────┘
                               │ REST + Server-Sent Events
                               ▼
   ┌───────────────────────────────────────────────────┐
   │ NestJS (one process, 127.0.0.1)                   │
   │                                                   │
   │  controllers → services → helpers → repositories  │
   │                                        │          │
   │  schedulers (cron)    agent team ──────┤          │
   │                       (Claude)         ▼          │
   │                                   PostgreSQL      │
   └───────────────────────────┬───────────────────────┘
                               │ outbound only
     ┌──────────┬──────────┬───┴──────┬───────────┬────────────────────┐
     ▼          ▼          ▼          ▼           ▼                    ▼
   Gmail /   Nextcloud   Proxmox   Anthropic   Forgejo, Home       openGym,
   Google    (WebDAV,    API, SSH  (Claude)    Assistant,          TREK, …
   Tasks     CalDAV)                           AdGuard Home
```

All integrations are outbound: the backend calls the external APIs, nothing calls in (the
Google OAuth callback is the one exception).

## Monorepo layout

npm workspaces, a single `package-lock.json` at the root.

```
apps/backend     NestJS 11 + Prisma 7 + PostgreSQL     (@myhomelab/backend)
apps/frontend    React 19 + Vite + SCSS                 (@myhomelab/frontend)
packages/shared  types and constants used by both sides (@myhomelab/shared)
apps/mobile      Android app (React Native + Expo, TS)  — not an npm workspace
deploy/proxmox   LXC installer (creates the CT, installs, updates, backs up)
releases/        release notes per version, in en / pt-PT / es
scripts/         release and Android build scripts
```

- `packages/shared` must be built before the backend or frontend imports it. The root
  `dev*` and `build` scripts do this for you.
- `apps/mobile` has its own `package-lock.json` and is installed from inside its folder. It
  stays out of the workspaces so the server's `npm ci` never downloads React Native.

## Backend: four layers

Every domain module has the same shape and the same four layers:

| Layer | Responsibility | Never does |
|---|---|---|
| **Controller** | Routes, guards, reading `req.user.id`, DTO validation | Business logic |
| **Service** | Thin shell: injects repositories and calls the right helper | Touch Prisma |
| **Helper** | One business operation — one exported function per file, all inputs as arguments | Be a class or hold state |
| **Repository** | Prisma access; encrypts/decrypts stored credentials | Business rules |

Helpers being plain functions is what lets the same operation be called by a controller, a
scheduler or an agent tool. Some newer modules (board, todos, app updates, notifications…)
talk to `PrismaService` directly from the service and skip the repository layer.

Other cross-cutting decisions:

- **Sessions** are a JWT in an httpOnly, `sameSite: strict` cookie (`secure` behind HTTPS),
  with `aud: "session"` and the user's `tokenVersion`. Each request re-reads the user (and
  role) from the database; logging out bumps `tokenVersion`. Admin routes add a roles guard.
- **API responses never carry secrets**: connected accounts go out through `toAccountView`
  (no tokens, passwords or client secrets), on list, create and update alike.
- **Ownership**: every helper checks the `userId` before reading or writing; another user's
  resource is a 404.
- **Credentials at rest** (OAuth tokens, app passwords, server secrets) are encrypted with
  AES-256-GCM using `TOKEN_ENCRYPTION_KEY`, inside the repository boundary.
- **Live state over SSE**: what each agent is doing is kept in memory and streamed to the
  browser (`GET /agent/stream`). SSE was chosen over WebSockets because the traffic is
  one-way and it reuses the session cookie.
- **Single instance**: in-memory activity, schedulers without a distributed lock and
  short-lived proposals assume one backend process. Scaling out would need that state moved
  to the database or Redis.

## The AI agent team

Each user has a **team of agents**, stored in the database (`Agent` table) and edited on
the **Workflow** page: name, description, who it reports to, model, effort, instructions
and tools.

```
              Assistant page · Android app   (POST /assistant/chat)
                              │
                              ▼
                     Jarvis — CEO (root agent)
                 talks to the user, delegates work
               ┌──────────────┼───────────────┬──────────────┐
          ask_admin       ask_infra        ask_doctor      ask_<key>
               ▼              ▼                ▼              ▼
        Administrative   Infrastructure     Personal      any agent the
        assistant        engineer           doctor        user creates
        (email, rules,   (servers,             │
         tasks)           backups, updates)    ├── health data scientist
                              │                └── personal trainer
                              └── Proxmox operator
```

- **Jarvis (CEO)** is the root agent (`reportsToId = null`) and the only one that talks to
  the user. A fresh install creates only Jarvis; the rest of the team is built on the
  Workflow page (or by asking Jarvis) from the bundled templates.
- **One generic executor** (`runTeamAgent`) runs any agent from its configuration: it
  composes the instructions, picks the model and effort, builds the toolbox, and adds one
  `ask_<key>` tool per active subordinate. A delegation is just a tool call; the
  subordinate returns a short report to its manager. Maximum depth is 5.
- **Tools** live in toolsets under `apps/backend/src/assistant/toolsets/` (email, servers,
  server control/shell, health, docs, updates, schedules, board, todos, Forgejo, Home
  Assistant, AdGuard, Nextcloud, team management…). The catalogue in
  `agent/tool-catalog.ts` lists every tool with its group and whether it reads or writes.
- **Three permission layers** — an agent can only do what all three allow:
  1. the tools assigned to the agent (Workflow page);
  2. per-area permissions for the whole assistant (Assistant → Settings → Permissions);
  3. per-app / per-server access for each agent: none, read or write.
- **AI provider**: Anthropic's Claude, from one of two providers chosen per user in Settings → AI
  (only one is in use):
  - **Claude Code** — the Claude CLI (`claude`) installed on the server, signed in with the
    user's Claude subscription (or a token pasted in Settings → AI). Each agent only gets the
    MyHomeLab tools, exposed through a local MCP bridge; nothing from the machine (shell,
    files, web) is available to it.
  - **Claude API** — the Anthropic Messages API with the user's pay-as-you-go key. The backend
    runs the tool loop itself with the same prompts and tools (system prompt cached).
  Saving an API key does not switch a user who already has Claude Code working; they pick it. Token usage is
  recorded per agent and source, with an optional monthly budget alert.
- **Mixed mode** (Settings → AI, needs the API key): each kind of work picks its own provider —
  chat (and one-off requests), update studies, installs and checks, scheduled runs, and
  subagents. By default light work (chat, studies) goes through the API and long work stays in
  Claude Code. A subagent runs on the delegation provider whatever its lead uses. Apps with an
  MCP server (TREK, openGym) use it in both: Claude Code connects to it directly, and with the
  API the backend is the MCP client.
- **Cron jobs**: fixed tasks written in code (`cron-job/cron-job.registry.ts`) that MyHomeLab runs
  on its own, without AI, at the interval each user picks on the app's Cron jobs page (off, hourly,
  every 6 or 12 hours, daily, weekly). A scheduler checks every minute and runs the due ones one at
  a time, recording the result. AdGuard has two: refresh the blocklists and refresh the allowlists;
  turning one on sets AdGuard's own refresh interval to "never" so lists are not fetched twice.
  Every self-hosted app with version detection has an **updates** cron job (Home Assistant and
  Nextcloud have a second one for their add-ons/HACS/firmware or their Nextcloud apps): it checks
  for a new version and, with "Put in a project", puts each available update on the board straight
  away in the chosen column (Todo, or Waiting for study so the study starts on its own), one per
  app or component at a time. Updates covered this way are not sent to `ON_NEW_UPDATE` triggers.
  Proxmox servers have the **disk almost full alert**: it reads each running CT's root disk and,
  through the QEMU guest agent, each VM's filesystems (VMs without the agent are listed as
  unknown). Everything is the user's choice: limit, interval (down to every minute), which
  machines, Notifications, and whether an agent handles it. Each alert is a task on the server's
  board, and the path is code (`disk-alert/`): Todo → Study (the agent investigates and saves a
  plan with `disk_alert_save_study`) → In progress when the plan fits the user's limits (safe
  cleanup, or growing a CT disk up to a maximum, a step at a time, never leaving the storage below
  a minimum free) or Waiting for reply otherwise (always for VMs) → Verifying (MyHomeLab measures
  again) → Done. A "yes" on the task or moving it to In progress approves; an alert closes by itself
  when the disk drops below the limit. If the agent stops without `disk_alert_done` (restart, or it
  ended without calling it), the next measurement closes the alert (below the limit) or moves it to
  Waiting for reply; an alert of a machine removed from the server closes. Only one agent run per
  alert at a time.
- **Claude Code turns**: every Claude Code run starts `claude` processes (hundreds of MB each),
  so each user runs at most N jobs at once in Claude Code (Settings → AI, 1–6, default 2) and
  the rest wait their turn. Only the top of a chain takes a turn (or the first Claude Code run
  under an API lead); its subagents run inside it, so a lead waiting for a subagent never
  blocks the queue.

See [Agents and tools](./development/05-agents-and-tools.md) for the details.

## Docs as rules

Users keep Markdown **documents** in the app, of three kinds: **Rules** (what may be done and
how — the user's; agents follow them and propose changes), **Map** (what exists on a server or
an app; every server and connected app gets one generated by MyHomeLab from what it already
knows — machines, storage, versions, rules and labels — rebuilt daily, with a **Notes** section
that is never rewritten and belongs to the user and the agents) and **Log** (what was done — written by the agents and
shown in the History tab). The Documents tab is a tree: the user's own **sections** (and subsections) come first, and any
document can have **sub-documents** under it; documents outside the user's sections fall into
automatic groups — Servers and apps (by what they are linked to), Projects and General. Documents can be linked to a server, a machine, an app, a service monitor,
an agent, a project or a task. Starter documents and template sets (from
`templates/docs/` in the repository) give a new user something to start from.

Agents read these documents instead of having rules hard-coded:

- the agent's instructions carry only the index of the documents (one line each, no
  content); the documents linked to the agent or its projects, and those the request
  mentions, are listed at the end of the request as documents to read before acting;
- agents search and read documents with `docs_search` / `docs_read`; tools that change
  things refuse to run until every listed document has been read;
- agents can write their own documents (maps, logs), but for the user's documents they
  can only **propose** a change, which the user approves or rejects — what an agent learns
  reaches the user that way, as a change to a rule (a proposal can also merge several
  documents into one);
- precedence is **user rules > agent instructions**, and the more specific rule wins.

The code measures, executes and records; the brakes (what needs approval, which commands
are destructive) are the rules in the documents that the agents follow. A conflict checker
compares rules documents with each other and flags contradictions.

## App updates

MyHomeLab watches the versions of the connected apps, Home Assistant components and the
Proxmox VE hosts. A new version becomes an **available** update; an agent opens it and it
moves through the update project on the board:

```
available → Waiting for study → Study ─(safe: agent installs)─────────────────► Ready to update
                                   ├──► Waiting for reply ──(user approves)──────────►
                                   │                                                │
                                   └── Recheck later                                ▼
                                                              In progress → Verifying → Done
                                                                    └──► Failed (rolled back)
```

1. **Study** — an agent reads the release notes and known issues, checks the rules for that
   app and records a study with a risk and a recommendation.
2. **Decision** — a safe update (not a major jump, not high risk, no manual steps, the host
   only when low risk) goes straight to *Ready to update*. The rest, and anything the agent
   judges important, waits in *Waiting for reply* until the user moves it to *Ready to
   update* (drag on the board, "Yes, install" on the task, or the chat card).
3. **Install** — the installer picks up ready updates, **one at a time** per user, and asks
   an agent to prepare (validate the "before" points of the rules), snapshot and run it, with
   rollback if it fails.
4. **Verify** — the agent checks the "after" points and closes it as done.

Every study, preparation and verification is an **attempt** with each rule point marked
validated / not validated / not applicable, with the evidence. See
[App updates](./development/06-app-updates.md).

## Board, projects and triggers

- **Projects** is a task board (kanban, list and table views) with projects, columns,
  modules, cycles, tasks with keys like `ATU-12`, comments, links, relations and
  attachments. Agents can read and update it through the `board` toolset.
- The **updates project** is created automatically; each opened update is a task in it.
- Each task can have its own conversation with Jarvis; what the user says there counts as
  the answer to the task's open question.
- **Triggers** (schedules) are agent jobs: run once, daily, weekly, monthly, or "when a new
  update appears". The reply can go to a notification or to a new Jarvis conversation.
- **Tasks** (personal to-dos) is a separate, simpler module with lists, due dates and
  sub-tasks, synced both ways with Google Tasks and Nextcloud (CalDAV).

## Notifications

A single notification centre with a badge in the menu: service down, machine missing,
app update available, disk problems and warnings, certificate expiry, app problems, failed
backups, and agent notices. Most notifications close by themselves when the condition
clears (a service comes back, a backup succeeds); agent notices close with "Seen".
"Needs you" groups what is waiting for a user decision (update approvals, document
proposals, questions on tasks). A daily summary at 21:00 lists what the agents did on
their own in the last 24 hours and what the AI cost that day.

A service that goes down also opens a task on its server board ("Service X failed", in Todo) and the
server agent is asked to study it. When it comes back the task moves to Verifying, and once it has been
stable for 10 minutes MyHomeLab closes it as Done — unless someone moved it (for example to Waiting for
reply). A failure during an update of that app (or of the server's Proxmox) opens no task: it is noted on
the update's task instead, and if the service is still down after the update a task opens. Services of the
same server that go down within 5 minutes share one task and one agent (the task only moves to Verifying
when all of them are back). A service that goes down again less than 6 hours after its task closed
reopens it (with how many times it fell in 24 hours) without calling another agent; one that falls again
while its task is in Verifying goes back to In progress and the agent is called again (at most once every
6 hours). A service that is no longer monitored closes its open task.

## Internationalisation

- The interface is available in **pt-PT** (source language), **en** and **es**, with
  i18next. The choice is stored in the browser (Settings → Language).
- Strings live in `apps/frontend/src/i18n/locales/<language>/<namespace>.json`, one
  namespace per area; the three files of a namespace always have the same keys.
- Visible text is never hard-coded in JSX.
- Release notes are written in all three languages; the app shows the one for the current
  interface language, falling back to English.
- Still in Portuguese, coming from the backend: API error messages, agent names/actions and
  the assistant's replies. Error responses carry a `code` so the frontend can translate the
  common ones.
