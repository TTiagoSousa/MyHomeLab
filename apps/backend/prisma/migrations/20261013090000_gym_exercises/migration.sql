-- AlterTable: peso por série, opcional
ALTER TABLE "WorkoutExercise" ADD COLUMN "weightKg" DOUBLE PRECISION;

-- Musculação passa a ter tipo próprio, com os pesos livres da Huawei (279)
UPDATE "ExerciseType" SET "huaweiCodes" = '{140}' WHERE "id" = 'strength';

INSERT INTO "ExerciseType" ("id", "category", "unit", "huaweiCodes", "position") VALUES
    ('gym', 'SPORT', NULL, '{279}', 9);

UPDATE "Workout" SET "typeId" = 'gym' WHERE "sportType" = 279;

-- Exercícios de ginásio
INSERT INTO "ExerciseType" ("id", "category", "unit", "huaweiCodes", "position") VALUES
    ('bench_press',         'MOVE', 'REPS', '{}', 17),
    ('incline_bench_press', 'MOVE', 'REPS', '{}', 18),
    ('dumbbell_press',      'MOVE', 'REPS', '{}', 19),
    ('chest_fly',           'MOVE', 'REPS', '{}', 20),
    ('barbell_squat',       'MOVE', 'REPS', '{}', 21),
    ('leg_press',           'MOVE', 'REPS', '{}', 22),
    ('leg_extension',       'MOVE', 'REPS', '{}', 23),
    ('leg_curl',            'MOVE', 'REPS', '{}', 24),
    ('deadlift',            'MOVE', 'REPS', '{}', 25),
    ('romanian_deadlift',   'MOVE', 'REPS', '{}', 26),
    ('hip_thrust',          'MOVE', 'REPS', '{}', 27),
    ('calf_raises',         'MOVE', 'REPS', '{}', 28),
    ('shoulder_press',      'MOVE', 'REPS', '{}', 29),
    ('lateral_raises',      'MOVE', 'REPS', '{}', 30),
    ('shrugs',              'MOVE', 'REPS', '{}', 31),
    ('barbell_row',         'MOVE', 'REPS', '{}', 32),
    ('dumbbell_row',        'MOVE', 'REPS', '{}', 33),
    ('lat_pulldown',        'MOVE', 'REPS', '{}', 34),
    ('seated_row',          'MOVE', 'REPS', '{}', 35),
    ('bicep_curl',          'MOVE', 'REPS', '{}', 36),
    ('hammer_curl',         'MOVE', 'REPS', '{}', 37),
    ('tricep_pushdown',     'MOVE', 'REPS', '{}', 38),
    ('skull_crushers',      'MOVE', 'REPS', '{}', 39);
