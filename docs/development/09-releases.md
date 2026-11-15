# Releases

A release is an **annotated git tag `vX.Y.Z`** whose message is the English release notes.
The installed app lists releases from the tags, shows the notes in the interface language,
and lets the admin update to any newer one.

## Branches and commits

- Branch flow: **`develop` → `staging` → `main`**, with a **linear history** (fast-forward
  merges only).
- Work happens on `develop` (or on feature branches merged into it).
- Commits follow **Conventional Commits with a scope**, in **English**, on **one line**:

  ```
  feat(email-rule): archive matching mail after N days
  fix(board): keep the task open after a failed move
  refactor(app-update)!: rename the update states
  ```

The commit types drive the version number and the release notes, so choose them carefully.

## Versioning

The version is computed from the Conventional Commits since the last tag:

| Commits since the last release | Bump |
|---|---|
| any `!` after the type, or `BREAKING CHANGE` in a body | **major** |
| otherwise, at least one `feat` | **minor** |
| otherwise | **patch** |

In the notes, `feat` goes to **Features**, `fix` to **Fixes**, and `perf`, `refactor` and
other non-skipped types to **Improvements**. `chore`, `docs`, `ci`, `test`, `style` and
`build` commits are left out (unless they are breaking).

## Release notes

```
releases/vX.Y.Z/
├── en.md       generated, then edited if needed
├── pt-PT.md    written by hand
└── es.md       written by hand
```

The first line of `en.md` is `vX.Y.Z — title`, followed by the sections:

```markdown
v1.2.0 — Faster board

### Features
- **board**: bulk edit from the table view

### Fixes
- **todos**: keep sub-tasks when moving a list

### Improvements
- **app-update**: clearer study questions
```

The translations use the same `### Features`, `### Fixes` and `### Improvements` headings.
The app shows the notes for the interface language, falling back to English, then to the
tag message.

## The flow

1. **Prepare, on `develop`:**

   ```bash
   npm run release -- --prepare
   ```

   This computes the version from the commits since the last tag, bumps the version in
   every `package.json`, appends the entry to `CHANGELOG.md`, and writes
   `releases/vX.Y.Z/en.md` (first line `vX.Y.Z — title`, then `### Features`,
   `### Fixes`, `### Improvements`).

2. **Translate:** write `releases/vX.Y.Z/pt-PT.md` and `releases/vX.Y.Z/es.md` by hand, with
   the same headings.

3. **Commit:**

   ```bash
   git add -A
   git commit -m "chore(release): vX.Y.Z"
   ```

4. **Push and wait for CI** to pass on `develop`.

5. **Promote** — fast-forward `staging` and `main`:

   ```bash
   git checkout staging && git merge --ff-only develop && git push
   git checkout main    && git merge --ff-only staging && git push
   ```

6. **Tag and push, on `main`:**

   ```bash
   npm run release -- --push
   ```

   This creates the annotated tag `vX.Y.Z` with the English notes as its message and pushes
   it. A GitHub Actions workflow then creates the GitHub Release from the tag. The script
   also builds the Android APK and attaches it to that release (see [Mobile](./07-mobile.md));
   if that step fails, the tag stays — re-run `npm run release:android -- vX.Y.Z`.

## Options

| Option | Effect |
|---|---|
| `--dry-run` | Show the computed version and notes; change nothing |
| `--version X.Y.Z` | Force a version instead of computing it |
| `--title "…"` | Title on the first line of the generated notes |
| `--notes file.md` | Use a hand-written English notes file |
| `--allow-branch <branch>` | Run on a branch other than the expected one |

The script refuses to run with uncommitted changes, on a commit that is already a release,
or when the tag already exists.

## After the release

Installations see the new version under **Admin → Version** and can update from the app
(or with `myhomelab-update` in the container). See [Deployment](../deployment.md#4-updating).
