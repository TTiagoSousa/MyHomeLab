# Testing

## Backend unit tests (Jest)

The backend uses **Jest** with `ts-jest`, configured in `apps/backend/package.json`:
`rootDir: src`, test files matching `*.spec.ts`, Node environment, and a
`moduleNameMapper` so absolute `src/…` imports work in tests as they do in Nest.

Tests sit **next to the code** they cover, for example:

- `app-update/update-flow.spec.ts`, `update-attempt.spec.ts`, `host-update.spec.ts`
- `agent/helpers/appAccess.spec.ts`
- `server-connection/helpers/commandSafety.spec.ts`, `snapshotBeforeCommand.spec.ts`
- `todo-sync/reconcile-group.spec.ts`, `nextcloud-tasks.spec.ts`
- `claude-code/mcpBridge.spec.ts`, `utils/lisbonTime.spec.ts`

Run them:

```bash
npm test                                   # from the root: builds shared, then runs jest
npm test -w @myhomelab/backend             # backend only (shared must be built)
npm run test:watch -w @myhomelab/backend
npm run test:cov -w @myhomelab/backend
```

Guidelines:

- Test helpers and pure logic directly — helpers take their repositories as arguments, so
  they are easy to call with small fakes.
- Cover state machines and guards (update states, permissions, command classification)
  rather than thin controllers.
- Unit tests do not need a database or network access.

The frontend and the mobile app have no unit tests; they are checked by type checking and
building.

## Lint and type checks

```bash
npm run lint                         # backend + frontend (ESLint)
cd apps/mobile && npm run typecheck  # mobile
```

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `develop`, `staging` and
`main`. All jobs use the Node version from `.nvmrc`.

| Job | What it checks |
|---|---|
| **Backend** | `npm ci`, build shared, `prisma generate`, `tsc --noEmit`, `jest --ci`, backend build |
| **Frontend** | `npm ci`, build shared, frontend type check and build |
| **Mobile** | `npm ci` in `apps/mobile`, `npm run typecheck` |
| **Database migrations** | Applies every migration to an empty PostgreSQL 17 (`prisma migrate deploy`), then fails if the migrations do not match `schema.prisma` (`prisma migrate diff --exit-code`) |
| **Shell scripts** | `shellcheck --severity=warning deploy/proxmox/*.sh` |

The job names are required status checks on `main` and `staging`; if you rename a job,
update the branch protection rules too.

A separate **CodeQL** workflow analyses the JavaScript/TypeScript code and the workflows on
pushes, pull requests and weekly. Dependabot opens weekly dependency updates against
`develop`.

## Before opening a pull request

```bash
npm run lint
npm test
npm run build
```

If you touched the schema, make sure a migration is included (the **Database migrations**
job will fail otherwise). If you touched `deploy/proxmox/*.sh`, run `shellcheck` locally.
