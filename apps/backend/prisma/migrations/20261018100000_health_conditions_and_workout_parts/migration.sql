-- Alergias e doenças crónicas passam de texto livre no perfil para uma lista
-- (HealthCondition), a que os medicamentos se podem ligar. Os treinos ganham
-- sessões: um principal com outros como aquecimento, retorno à calma ou parte.

-- CreateTable
CREATE TABLE "HealthCondition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT,
    "since" DATE,
    "resolvedAt" DATE,
    "reaction" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthCondition_userId_kind_idx" ON "HealthCondition"("userId", "kind");

-- AddForeignKey
ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O texto antigo vira uma entrada ativa por linha (ou separada por ; ou ,).
INSERT INTO "HealthCondition" ("id", "userId", "kind", "name", "status", "updatedAt")
SELECT gen_random_uuid()::text, p."userId", 'ALLERGY', left(btrim(item), 120), 'ACTIVE', CURRENT_TIMESTAMP
FROM "HealthProfile" p, regexp_split_to_table(p."allergies", E'[\n;,]+') AS item
WHERE p."allergies" IS NOT NULL AND btrim(item) <> '';

INSERT INTO "HealthCondition" ("id", "userId", "kind", "name", "status", "updatedAt")
SELECT gen_random_uuid()::text, p."userId", 'CONDITION', left(btrim(item), 120), 'ACTIVE', CURRENT_TIMESTAMP
FROM "HealthProfile" p, regexp_split_to_table(p."conditions", E'[\n;,]+') AS item
WHERE p."conditions" IS NOT NULL AND btrim(item) <> '';

-- AlterTable
ALTER TABLE "HealthProfile" DROP COLUMN "allergies",
DROP COLUMN "conditions";

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "conditionId" TEXT;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "HealthCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "partRole" TEXT;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
