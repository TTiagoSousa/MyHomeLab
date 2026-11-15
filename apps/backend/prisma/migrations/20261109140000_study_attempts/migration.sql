-- O estudo também abre uma tentativa (os pontos das regras que se veem ao estudar).
-- CreateEnum
CREATE TYPE "UpdateAttemptKind" AS ENUM ('STUDY', 'UPDATE');

-- AlterTable
ALTER TABLE "UpdateAttempt" ADD COLUMN     "kind" "UpdateAttemptKind" NOT NULL DEFAULT 'UPDATE';

