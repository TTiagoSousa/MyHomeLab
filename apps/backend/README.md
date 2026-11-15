# @myhomelab/backend

The MyHomeLab API — **NestJS 11**, **Prisma 7** (pg adapter) and **PostgreSQL**. It serves
the frontend under `/api`, runs the schedulers (email rules, task sync, service checks,
app version checks) and hosts the Jarvis assistant and the Telegram bots.

## Run it

From the repository root (the shared package must be built first; the scripts do it):

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
npm run dev:backend            # http://localhost:3100
```

In this workspace:

| Command | What it does |
|---|---|
| `npm run start:dev` | Nest in watch mode |
| `npm run build` | `prisma generate` + `nest build` → `dist/` |
| `npm run start:prod` | `node dist/src/main.js` |
| `npm run lint` / `npm run format` | ESLint / Prettier |

> **Windows:** editing several files with `start:dev` running can leave Nest in an
> `EADDRINUSE` restart loop. Make the changes, then restart once.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | signs the session cookie |
| `TOKEN_ENCRYPTION_KEY` | yes | base64 of 32 bytes; encrypts every stored secret — **never change it** once in use |
| `PORT`, `HOST` | no | `3100` in development, `3000` in the container |
| `FRONTEND_URL` | yes | CORS origin, OAuth return and whether the cookie is `secure` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | for Gmail/Tasks | redirect URI: `<app>/api/connected-account/google/callback` |

AI keys, Proxmox servers, Telegram bots, AdGuard, Nginx Proxy Manager and Nextcloud credentials and Home Assistant and Coolify tokens are **not** environment
variables — each user adds their own in the app, and they are stored encrypted.

## Database

```bash
npx prisma migrate deploy      # apply migrations
npx prisma generate            # after changing prisma/schema.prisma
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Against the shared development database, generate the SQL with `migrate diff`, review it,
save it under `prisma/migrations/<timestamp>_<name>/` and apply with `migrate deploy`.

## Modules

| Module | Responsibility |
|---|---|
| `auth`, `user` | login (httpOnly JWT cookie), roles, users |
| `category`, `service` | the service catalogue |
| `connected-account` | Gmail and Nextcloud (backup destination) accounts, Google OAuth, encrypted tokens |
| `email-rule` | Gmail rules, the query builder, the scheduler |
| `assistant`, `agent`, `agent-activity` | Jarvis: main agent, email and server sub-agents, live activity (SSE) |
| `ai-credential` | per-user AI keys (Anthropic) |
| `server-connection`, `proxmox` | per-user Proxmox servers and the dashboard |
| `service-monitor` | watched services (HTTP/TCP), machine checks, AdGuard Home, Home Assistant, Nginx Proxy Manager, Coolify, Nextcloud, TREK, Vaultwarden, Immich, Paperless-ngx and PostgreSQL integrations (TREK and Vaultwarden need no credentials; their latest version — and Immich's and Paperless's — comes from GitHub releases; PostgreSQL is a direct `pg` connection) |
| `disk-health` | SMART of the Proxmox nodes' disks, hourly readings (one per disk per day), ZFS pools, disk alerts |
| `notification` | alerts, opened and resolved by the monitors and the disk checks; optional Nextcloud task per alert, completed when it resolves |
| `telegram` | one Telegram bot per user, long polling |
| `system` | versions, releases and in-app updates (admin) |

Controllers stay thin; logic lives in services and single-function helpers; repositories
wrap Prisma. See [`.claude/docs`](../../.claude/docs/README.md) for every module and
endpoint.
