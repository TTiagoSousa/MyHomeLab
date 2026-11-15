# Database

PostgreSQL, accessed through **Prisma 7**. The schema is the single source of truth:
`apps/backend/prisma/schema.prisma`. The generated client goes to
`apps/backend/src/generated/prisma/` (do not edit).

## Main areas of the schema

| Area | Models (examples) |
|---|---|
| Users and catalogue | `User`, `Category`, `Service` |
| Connected apps and email | `ConnectedAccount`, `EmailRule`, `EmailRuleProposal` |
| Assistant | `Agent`, `AgentLog`, `Conversation`, `ChatMessage`, `AiCredential`, `AiUsage`, `AssistantPermissionSetting`, `AgentAppAccess` |
| Documents | `Doc`, `DocType`, `DocLink`, `DocVersion`, `DocProposal` |
| Updates | `AppUpdate`, `UpdateAttempt`, `UpdateAttemptCheck`, `UpdateWorkflowSetting` |
| Board and triggers | `Project`, `BoardState`, `BoardModule`, `BoardCycle`, `BoardTask` (+ comments, links, relations, attachments, activity), `AgentSchedule`, `AgentScheduleRun` |
| Personal tasks | `TodoList`, `Todo`, `TodoSyncSetting`, `TodoSyncGroup`, `TodoSyncLink`, `TodoSyncItem` |
| Infrastructure | `ServerConnection`, `ServerCommand`, `ServiceMonitor`, `DiskReading`, `Notification` |
| Backups | `BackupDestination`, `BackupJob`, `BackupRun` |
| Health | sleep, heart, steps, workouts, labs, medication, nutrition, body, wellbeing, medical records… |

Almost every row has a `userId`: data is per user. Secrets (tokens, passwords) are stored
encrypted with `TOKEN_ENCRYPTION_KEY` and only decrypted inside repositories.

## Changing the schema

1. Edit `apps/backend/prisma/schema.prisma`.
2. Create a migration, from `apps/backend`:

   ```bash
   npx prisma migrate dev --name <short_name>
   ```

3. Regenerate the client (the build also does this):

   ```bash
   npx prisma generate
   ```

4. Commit the schema and the new folder under `prisma/migrations/` together.

### Against a shared development database

`migrate dev` may ask to reset the database when it detects drift. On a database you share
or care about, generate the SQL instead, review it, and apply it with `migrate deploy`:

```bash
cd apps/backend
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > migration.sql
# review migration.sql, then place it in prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
```

## In production

`npx prisma migrate deploy` runs on every install and update, before the backend restarts.
The updater dumps the database first and restores it if a later step fails. Migrations are
forward-only: the app never offers to downgrade.

Guidelines for migrations:

- Make data migrations idempotent where possible (they may run on databases in different
  states).
- When removing a feature, drop its tables and enum values in a migration of its own with a
  clear name.
- Seed data the app needs (for example the root agent or the updates project) is created by
  the code on first use, not by migrations.
