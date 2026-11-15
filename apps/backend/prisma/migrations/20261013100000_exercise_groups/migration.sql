-- AlterTable: o grupo muscular de cada exercício, para os organizar nas listas
ALTER TABLE "ExerciseType" ADD COLUMN "group" TEXT;

UPDATE "ExerciseType" SET "group" = 'chest'
WHERE "id" IN ('push_ups', 'bench_press', 'incline_bench_press', 'dumbbell_press', 'chest_fly');

UPDATE "ExerciseType" SET "group" = 'back'
WHERE "id" IN ('pull_ups', 'barbell_row', 'dumbbell_row', 'lat_pulldown', 'seated_row');

UPDATE "ExerciseType" SET "group" = 'legs'
WHERE "id" IN ('squats', 'lunges', 'wall_sit', 'glute_bridges', 'barbell_squat', 'leg_press',
               'leg_extension', 'leg_curl', 'deadlift', 'romanian_deadlift', 'hip_thrust', 'calf_raises');

UPDATE "ExerciseType" SET "group" = 'shoulders'
WHERE "id" IN ('shoulder_press', 'lateral_raises', 'shrugs');

UPDATE "ExerciseType" SET "group" = 'arms'
WHERE "id" IN ('dips', 'bicep_curl', 'hammer_curl', 'tricep_pushdown', 'skull_crushers');

UPDATE "ExerciseType" SET "group" = 'core'
WHERE "id" IN ('sit_ups', 'plank', 'side_plank', 'leg_raises', 'russian_twists', 'mountain_climbers');

UPDATE "ExerciseType" SET "group" = 'full_body'
WHERE "id" IN ('burpees', 'jumping_jacks', 'jump_rope');
