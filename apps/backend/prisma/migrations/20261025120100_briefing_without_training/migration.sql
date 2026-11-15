-- O resumo da manhã deixa de ter a secção do treino (os planos saíram com o openGym).
ALTER TABLE "BriefingSetting" ALTER COLUMN "sections" SET DEFAULT ARRAY['emails', 'tasks', 'calendar', 'sleep', 'servers']::TEXT[];
UPDATE "BriefingSetting" SET "sections" = array_remove("sections", 'training');
