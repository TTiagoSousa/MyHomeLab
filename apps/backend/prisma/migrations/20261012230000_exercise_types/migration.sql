-- CreateTable
CREATE TABLE "ExerciseType" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "huaweiCodes" INTEGER[],
    "position" INTEGER NOT NULL,

    CONSTRAINT "ExerciseType_pkey" PRIMARY KEY ("id")
);

-- O catálogo predefinido. Desportos (SPORT): classificam um treino inteiro e
-- apanham os códigos da Huawei. Exercícios (MOVE): para os treinos manuais.
INSERT INTO "ExerciseType" ("id", "category", "unit", "huaweiCodes", "position") VALUES
    ('walking',           'SPORT', NULL, '{257,281}', 1),
    ('running',           'SPORT', NULL, '{258,264}', 2),
    ('trail_running',     'SPORT', NULL, '{280}',     3),
    ('hiking',            'SPORT', NULL, '{260,282}', 4),
    ('cycling',           'SPORT', NULL, '{259,265}', 5),
    ('swimming',          'SPORT', NULL, '{262,266}', 6),
    ('football',          'SPORT', NULL, '{270}',     7),
    ('basketball',        'SPORT', NULL, '{271}',     8),
    ('strength',          'SPORT', NULL, '{140,279}', 9),
    ('core',              'SPORT', NULL, '{157}',     10),
    ('hiit',              'SPORT', NULL, '{143}',     11),
    ('functional',        'SPORT', NULL, '{146,147}', 12),
    ('aerobics',          'SPORT', NULL, '{139}',     13),
    ('yoga',              'SPORT', NULL, '{137}',     14),
    ('stairs',            'SPORT', NULL, '{261}',     15),
    ('elliptical',        'SPORT', NULL, '{273}',     16),
    ('rowing',            'SPORT', NULL, '{274}',     17),
    ('other',             'SPORT', NULL, '{}',        99),
    ('push_ups',          'MOVE',  'REPS',    '{}', 1),
    ('sit_ups',           'MOVE',  'REPS',    '{}', 2),
    ('plank',             'MOVE',  'SECONDS', '{}', 3),
    ('side_plank',        'MOVE',  'SECONDS', '{}', 4),
    ('squats',            'MOVE',  'REPS',    '{}', 5),
    ('lunges',            'MOVE',  'REPS',    '{}', 6),
    ('burpees',           'MOVE',  'REPS',    '{}', 7),
    ('pull_ups',          'MOVE',  'REPS',    '{}', 8),
    ('dips',              'MOVE',  'REPS',    '{}', 9),
    ('jumping_jacks',     'MOVE',  'REPS',    '{}', 10),
    ('mountain_climbers', 'MOVE',  'REPS',    '{}', 11),
    ('leg_raises',        'MOVE',  'REPS',    '{}', 12),
    ('russian_twists',    'MOVE',  'REPS',    '{}', 13),
    ('glute_bridges',     'MOVE',  'REPS',    '{}', 14),
    ('wall_sit',          'MOVE',  'SECONDS', '{}', 15),
    ('jump_rope',         'MOVE',  'SECONDS', '{}', 16);

-- AlterTable: os treinos já importados ficam com o tipo do código da Huawei
ALTER TABLE "Workout" ADD COLUMN "typeId" TEXT,
ADD COLUMN "notes" TEXT,
ALTER COLUMN "sportType" DROP NOT NULL;

UPDATE "Workout" AS w SET "typeId" = t."id"
FROM "ExerciseType" AS t
WHERE w."sportType" = ANY (t."huaweiCodes");

UPDATE "Workout" SET "typeId" = 'other' WHERE "typeId" IS NULL;

ALTER TABLE "Workout" ALTER COLUMN "typeId" SET NOT NULL;

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ExerciseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ExerciseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
