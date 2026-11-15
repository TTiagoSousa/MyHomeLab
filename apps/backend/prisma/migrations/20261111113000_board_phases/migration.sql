-- As divisões do quadro: cada coluna pode pertencer a uma fase (as linhas a separar).
-- AlterTable
ALTER TABLE "BoardState" ADD COLUMN     "phase" TEXT;

-- As colunas das atualizações ficam já divididas pelas fases do processo.
UPDATE "BoardState" SET "phase" = CASE "key"
    WHEN 'new' THEN 'Entrada'
    WHEN 'study' THEN 'Entrada'
    WHEN 'studying' THEN 'Estudo'
    WHEN 'studied' THEN 'Estudo'
    WHEN 'ready' THEN 'Decisão'
    WHEN 'waiting' THEN 'Decisão'
    WHEN 'later' THEN 'Decisão'
    WHEN 'in_progress' THEN 'Atualização'
    WHEN 'verifying' THEN 'Atualização'
    WHEN 'done' THEN 'Fim'
    WHEN 'failed' THEN 'Fim'
    WHEN 'cancelled' THEN 'Fim'
  END
WHERE "key" IS NOT NULL;
