-- Os suplementos passam para a medicação: os itens próprios de suplementos dos
-- consumos viram entradas da medicação (tipo SUPPLEMENT) e saem dos consumos.
-- Os registos antigos ficam no histórico dos consumos.
INSERT INTO "Medication" ("id", "userId", "kind", "name", "doseAmount", "doseUnit", "times", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "userId",
  'SUPPLEMENT',
  "name",
  "amount",
  CASE
    WHEN "unit" = 'IU' THEN 'iu'
    WHEN "unit" IN ('g', 'mg', 'mcg', 'ml', 'tablet', 'capsule', 'drops') THEN "unit"
    ELSE NULL
  END,
  ARRAY[]::TEXT[],
  CASE
    WHEN "unit" IN ('sachet', 'scoop') THEN 'Dose: ' || COALESCE("amount"::text || ' ', '') || "unit"
    ELSE NULL
  END,
  NOW(),
  NOW()
FROM "IntakeItem"
WHERE "kind" = 'SUPPLEMENT';

DELETE FROM "IntakeItem" WHERE "kind" = 'SUPPLEMENT';
