-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MonitorApp" ADD VALUE 'VAULTWARDEN';
ALTER TYPE "MonitorApp" ADD VALUE 'IMMICH';
ALTER TYPE "MonitorApp" ADD VALUE 'PAPERLESS';
ALTER TYPE "MonitorApp" ADD VALUE 'POSTGRES';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'APP_PROBLEM';

