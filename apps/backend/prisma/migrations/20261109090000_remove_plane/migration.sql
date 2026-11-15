-- O Plane sai: as contas dele (e o que delas depende), as ferramentas dos agentes e as permissões.
DELETE FROM "ConnectedAccount" WHERE "provider" = 'PLANE';
UPDATE "Agent" SET "tools" = ARRAY(SELECT t FROM unnest("tools") AS t WHERE t NOT LIKE 'plane\_%'), "updatedAt" = NOW() WHERE EXISTS (SELECT 1 FROM unnest("tools") AS t WHERE t LIKE 'plane\_%');
UPDATE "AssistantPermissionSetting" SET "denied" = ARRAY(SELECT d FROM unnest("denied") AS d WHERE d NOT LIKE 'plane.%');

-- AlterEnum
BEGIN;
CREATE TYPE "ConnectionProvider_new" AS ENUM ('GMAIL', 'OUTLOOK', 'IMAP', 'NEXTCLOUD', 'FORGEJO', 'TREK', 'HOME_ASSISTANT', 'ADGUARD');
ALTER TABLE "public"."ConnectedAccount" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "ConnectedAccount" ALTER COLUMN "provider" TYPE "ConnectionProvider_new" USING ("provider"::text::"ConnectionProvider_new");
ALTER TYPE "ConnectionProvider" RENAME TO "ConnectionProvider_old";
ALTER TYPE "ConnectionProvider_new" RENAME TO "ConnectionProvider";
DROP TYPE "public"."ConnectionProvider_old";
ALTER TABLE "ConnectedAccount" ALTER COLUMN "provider" SET DEFAULT 'GMAIL';
COMMIT;

-- AlterTable
ALTER TABLE "ConnectedAccount" DROP COLUMN "appWorkspace";

