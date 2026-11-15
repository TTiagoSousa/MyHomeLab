# Getting started

## Prerequisites

- **Node.js 22** (see `.nvmrc`; `engines.node` is `>=22`).
- **PostgreSQL** (any recent version; production uses the Debian package).
- **git**.
- Optional, for the assistant: the **Claude CLI** (`claude`) signed in with a Claude
  subscription. Without it the app runs, but the AI features return an error.
- Optional, for the Android app: see [Mobile](./07-mobile.md).

## Install

Always install from the repository root — it is an npm workspace with a single lockfile:

```bash
git clone https://github.com/TTiagoSousa/MyHomeLab.git
cd MyHomeLab
npm install
```

This installs `packages/shared`, `apps/backend` and `apps/frontend`. The Android app
(`apps/mobile`) is installed separately, inside its own folder.

## Database

Create a database and user, for example:

```sql
CREATE USER myhomelab WITH PASSWORD 'password';
CREATE DATABASE myhomelab OWNER myhomelab;
```

Then apply the migrations:

```bash
cd apps/backend
npx prisma migrate deploy
```

## Environment

Backend — copy the template and fill it in:

```bash
cp apps/backend/.env.example apps/backend/.env
```

| Variable | Value for local development |
|---|---|
| `PORT` | `3100` |
| `HOST` | `0.0.0.0` (production uses `127.0.0.1`) |
| `DATABASE_URL` | your local database |
| `JWT_SECRET` | any long random string |
| `TOKEN_ENCRYPTION_KEY` | base64 of 32 random bytes — **do not change it after connecting accounts** |
| `FRONTEND_URL` | `http://localhost:5180` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` | only if you work on Gmail / Google Tasks |
| `CLAUDE_BIN` | only if `claude` is not on the `PATH` |

The comments in `.env.example` show one-liners to generate the secrets.

Frontend — create `apps/frontend/.env.local`:

```
VITE_API_URL=http://localhost:3100
```

## Run

```bash
npm run dev
```

| Service | URL |
|---|---|
| Backend | http://localhost:3100 |
| Frontend | http://localhost:5180 (Vite with `strictPort`) |

On a fresh database, open the frontend and register: the first user becomes the admin
(`POST /auth/register` only works while the user table is empty).

## Root scripts

| Command | What it does |
|---|---|
| `npm install` | Install the three workspaces |
| `npm run dev` | Shared in watch mode + backend + frontend |
| `npm run dev:backend` / `npm run dev:frontend` | Only one side |
| `npm run build:shared` | Build `@myhomelab/shared` |
| `npm run build` | shared → backend → frontend |
| `npm run lint` | Lint backend and frontend |
| `npm test` | Build shared, then run the backend tests |
| `npm run release` | Release tooling (see [Releases](./09-releases.md)) |
| `npm run release:android` | Build and publish the Android APK |

`@myhomelab/shared` must be compiled before the backend or frontend imports it. The `dev*`
and `build` scripts do it; if you change `packages/shared` while the backend is stopped, run
`npm run build:shared` again.

## Tips

- **Windows**: editing backend files while `nest --watch` is running can leave it in a
  crash loop with `EADDRINUSE`. Make your changes, then do one clean restart.
- After changing `schema.prisma`, run `npx prisma generate` (the build does it too).

## Next

- [Backend](./02-backend.md) · [Frontend](./03-frontend.md) · [Database](./04-database.md)
