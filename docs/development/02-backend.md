# Backend

`apps/backend` — NestJS 11, TypeScript, Prisma 7, PostgreSQL. Entry point `src/main.ts`,
root module `src/app.module.ts`.

## Layout

```
apps/backend/
├── prisma/
│   ├── schema.prisma        source of truth for the data model
│   └── migrations/
├── src/
│   ├── main.ts              bootstrap: logger, cookies, validation, CORS, HOST/PORT
│   ├── app.module.ts        registers every module
│   ├── auth/ user/          login, JWT, guards; users and admin management
│   ├── category/ service/   service catalogue
│   ├── connected-account/   connected apps (Gmail, Google Tasks, Nextcloud, Forgejo, …)
│   ├── email-rule/          Gmail rules engine (+ email-rule-proposal/)
│   ├── agent/               agent team, tool catalogue, prompts, permissions, app access
│   ├── assistant/           chat API, agent executor, toolsets
│   ├── claude-code/         runner for the Claude CLI and the local MCP bridge
│   ├── agent-schedule/      triggers (agent jobs) and the daily summary
│   ├── board/               projects board
│   ├── todo/ todo-sync/     personal tasks and Google Tasks / Nextcloud sync
│   ├── docs/                documents, proposals, conflict checker
│   ├── app-update/          app / host updates: records, attempts, runner
│   ├── server-connection/   Proxmox servers, SSH commands
│   ├── service-monitor/     HTTP/TCP monitors
│   ├── disk-health/         SMART and ZFS readings
│   ├── backup/              backup destinations and jobs
│   ├── health/              health data
│   ├── notification/        notifications
│   ├── ai-credential/       AI provider settings and usage
│   ├── system/              version, releases, self-update, status
│   ├── proxmox/ nextcloud/  plain-function API clients
│   └── utils/               crypto, concurrency, dates
└── .env.example
```

## Anatomy of a module

```
<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts     routes + guards + DTOs
├── <domain>.service.ts        thin shell: delegates to helpers
├── <domain>.scheduler.ts      (optional) cron work
├── dto/                       class-validator DTOs; Update = PartialType(Create)
├── helpers/                   one exported function per file
└── repositories/
    ├── <x>-repository.ts      interface + helper types
    └── prisma/prisma-<x>-repository.ts
```

### The four layers

**Controller** — applies guards, reads `req.user.id`, calls the service. Nothing else.

```ts
@Controller('category')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() req: Request & { user: JwtPayload }) {
    return this.categoryService.create(dto, req.user.id);
  }
}
```

**Service** — no logic; receives repositories by injection and passes them to the helper.

```ts
async create(dto: CreateCategoryDto, userId: string) {
  return createCategory(dto, userId, this.categoryRepository);
}
```

**Helper** — one business operation, all inputs as arguments, no state. Business
validation and Nest HTTP exceptions live here. Helpers compose: `deleteX` calls `findX`
first, and `findX` is the ownership guard (404 if missing **or not the user's**).

```ts
export async function createCategory(dto, userId, categoryRepository) {
  const exists = await categoryRepository.findByUserAndName(userId, dto.name);
  if (exists) throw new ConflictException('…');
  const order = await categoryRepository.countByUser(userId);
  return categoryRepository.create({ name: dto.name, userId, order });
}
```

**Repository** — interface first, Prisma implementation second. Only repositories touch
`PrismaService`, and they encrypt/decrypt stored credentials, so the rest of the app never
sees ciphertext.

Some newer modules (board, todos, app updates, notifications, monitors…) skip the
repository layer and use `PrismaService` from the service directly.

External API clients (`proxmox/`, `nextcloud/`, the Google clients) are plain function
modules, not injectable providers, so agents and schedulers can reuse them.

## Conventions

- **Never trust a `userId` from the body** — it always comes from `req.user.id`.
- **Route order**: literal routes before parameterised ones (`@Patch('reorder')` before
  `@Patch(':id')`).
- **Validation**: a global `ValidationPipe` with `transform` and `whitelist`; undeclared
  fields are silently dropped.
- **Ordering**: sortable entities have an integer `order`. Create appends at the end;
  delete closes the gap; reorder checks that the submitted ids are exactly the user's ids
  and applies them in a transaction.
- **Errors**: Nest exceptions with a message that says what to do. Where the frontend must
  react, include a `code` (e.g. `AI_KEY_MISSING`, `SERVER_UNREACHABLE`).
- **Naming**: files `kebab-case.type.ts`, helpers `camelCase.ts` named after their
  function, classes `PascalCase`, module constants `SCREAMING_SNAKE`.
- **Comments** explain *why*, not *what* (backend comments are in European Portuguese).

## Schedulers

Each `@Cron` has a `name`, which is what **Admin → Status** shows. The usual pattern:

```ts
for (const account of dueAccounts) {
  try { await work(account); }
  catch (error) { this.logger.error(message, error instanceof Error ? error.stack : undefined); }
  finally { await repo.update(account.id, { lastRunAt: new Date() }); }
}
```

The `finally` matters: a failing account must not retry in a tight loop. Filter by provider
before the loop. Schedulers assume a single backend instance (no distributed lock).

Exception: the Gmail rules scheduler only records `lastRunAt` after a successful run (so the
page never says "ran 5 min ago" when it failed) and skips a tick while the previous one is
still running. A Google account whose access was revoked (`invalid_grant`) is set inactive
with a "reconnect" notification, so it leaves the loop instead of failing forever. Every
request to Google has a 30 s timeout.

## External app clients

Shared helpers for the `fetch`-based app clients live in `src/integrations/app-fetch.ts`:
`describeFetchError` turns undici's bare "fetch failed" into the real cause (self-signed
certificate, closed port, unknown host, timeout), `parseAppJson`/`looksLikeHtml` reject a 2xx
HTML page (an SSO login or proxy in front) instead of treating it as data, and
`isVersionString` keeps anything that is not a version out of the update checks. The
`fetch` clients do not accept self-signed certificates: use the LAN `http://` address, a valid
certificate, or add your CA with `NODE_EXTRA_CA_CERTS` in the backend's service environment.
Release lookups are cached for an hour and failures for 15 minutes; an optional
`GITHUB_TOKEN` raises GitHub's limit from 60 to 5000 requests per hour.

## Bootstrap notes

- No global route prefix; nginx owns `/api` in production.
- CORS uses `FRONTEND_URL` with `credentials: true` — without it the session cookie and SSE
  fail.
- `enableShutdownHooks()` so systemd's SIGTERM closes database connections cleanly.
- The compiled entry point is `dist/src/main.js` (not `dist/main.js`), because
  `prisma.config.ts` at the package root shifts the TypeScript output root.

## Adding a module

1. Create `src/<domain>/` with the layout above.
2. Repository interface, then its Prisma implementation.
3. One helper per operation, taking repositories as arguments.
4. A service that only delegates and a controller that only routes.
5. Register the module in `app.module.ts`; export the repository if another module needs it.
6. Add the routes to `apps/frontend/src/Service/endPoints.ts` and to [the API docs](../api.md).
