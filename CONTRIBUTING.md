# Contributing to MyHomeLab

Thanks for helping! This guide covers how to run the project, the branches, the commits and
how a release is made. The full development guides are in [`docs/development/`](./docs/development).

By taking part you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Security issues
are reported privately — see [`SECURITY.md`](./SECURITY.md).

## Run it locally

Requires **Node 22+** (see `.nvmrc`) and a **PostgreSQL** database.

```bash
npm install                                       # always from the repository root
cp apps/backend/.env.example apps/backend/.env    # fill in DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPTION_KEY…
cd apps/backend && npx prisma migrate deploy && cd ../..
npm run dev                                       # shared + backend (:3100) + frontend (:5180)
```

| Command | What it does |
|---|---|
| `npm run dev` | shared package in watch mode, backend and frontend |
| `npm run dev:backend` / `npm run dev:frontend` | just one side |
| `npm run build` | shared → backend → frontend |
| `npm test` | backend unit tests (Jest) |
| `npm run release -- --dry-run` | preview the next release |

The Android app (`apps/mobile`) is outside the npm workspaces and installs on its own:
`cd apps/mobile && npm install`. See [`docs/development/07-mobile.md`](./docs/development/07-mobile.md).

## Branches

```
feature branch ──► develop ──► staging ──► main ──► tag vX.Y.Z
```

- **`develop`** — where work lands. Open pull requests against `develop`.
- **`staging`** — what is about to be released.
- **`main`** — the released code; every release is an annotated tag on `main`.

History is linear: `staging` and `main` only move with `git merge --ff-only`. Both are
protected (no deletion, no force push, the CI checks must pass).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) **with a scope, in English, on one
line**:

```
feat(app-update): verify Home Assistant parts after install
fix(board): move the card back when a column change is not allowed
docs: explain the release flow
ci: cache npm in the backend job
build(deps): bump prisma to 7.1.0
chore(release): v1.2.0
```

The type decides the next version: `feat` bumps the minor, `fix` and the others the patch, and a
`!` (`feat(api)!: …`) or a `BREAKING CHANGE:` footer bumps the major.

## Code conventions

- **Backend** (NestJS): four layers — controller → service → helper (one function per file) →
  repository. Comments in European Portuguese are fine.
- **Frontend** (React): no comments in the code; small files; hooks in the style of the existing
  ones (`useState` + an async `fetchX` called in `useEffect`).
- **i18n**: never write visible text in JSX. Add the key in `pt-PT`, `en` and `es`
  (`apps/frontend/src/i18n/locales/<language>/<namespace>.json`).
- **Database**: change `apps/backend/prisma/schema.prisma` and add a migration
  (`npx prisma migrate dev --name <name>` in `apps/backend`). The CI checks that the migrations
  match the schema.
- **Documentation**: when a feature changes, update `docs/` in the same pull request.
- **No secrets** in the code, the commits or the screenshots: `.env` files stay local.

## Pull requests

1. Fork and branch off `develop` (`feat/short-name`).
2. Make the change with tests where it makes sense; run `npm run build` and `npm test`.
3. Open the pull request against `develop` and fill in the template.
4. The CI must pass: **Backend**, **Frontend**, **Database migrations**, **Shell scripts**.

## Making a release (maintainers)

1. On `develop`: `npm run release -- --prepare` — computes the version from the commits since the
   last tag, bumps every `package.json`, adds the version to `CHANGELOG.md` and writes
   `releases/vX.Y.Z/en.md`.
2. Write `releases/vX.Y.Z/pt-PT.md` and `releases/vX.Y.Z/es.md` by hand (same headings).
3. Commit: `chore(release): vX.Y.Z`.
4. Push `develop` and wait for the CI.
5. Fast-forward `staging` and then `main`:
   `git checkout staging && git merge --ff-only develop && git push`, then the same for `main`
   from `staging`.
6. On `main`: `npm run release -- --push` — creates the annotated tag with the English notes and
   pushes it. The **Release** workflow checks the versions and creates the GitHub Release; the
   Android APK is attached to it.

Details: [`docs/development/09-releases.md`](./docs/development/09-releases.md).
