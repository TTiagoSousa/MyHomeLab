-- AlterTable: só os exercícios de ginásio levam peso; os de peso corporal não
ALTER TABLE "ExerciseType" ADD COLUMN "weighted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ExerciseType" SET "weighted" = true
WHERE "id" IN ('bench_press', 'incline_bench_press', 'dumbbell_press', 'chest_fly', 'barbell_squat',
               'leg_press', 'leg_extension', 'leg_curl', 'deadlift', 'romanian_deadlift', 'hip_thrust',
               'calf_raises', 'shoulder_press', 'lateral_raises', 'shrugs', 'barbell_row', 'dumbbell_row',
               'lat_pulldown', 'seated_row', 'bicep_curl', 'hammer_curl', 'tricep_pushdown', 'skull_crushers');

-- Pesos que tenham ficado em exercícios de peso corporal deixam de contar
UPDATE "WorkoutExercise" AS e SET "weightKg" = NULL
FROM "ExerciseType" AS t
WHERE e."typeId" = t."id" AND t."weighted" = false AND e."weightKg" IS NOT NULL;
