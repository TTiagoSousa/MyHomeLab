-- AlterTable
ALTER TABLE "HealthDiaryEntry" ADD COLUMN     "trigger" TEXT;

-- AlterTable
ALTER TABLE "HealthProfile" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "conditions" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sex" TEXT;

