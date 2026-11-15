-- Os estados das atualizações no quadro: Todo (NEW), Espera por estudo (STUDY), Study (STUDYING), Ready to update (READY)…
ALTER TYPE "AppUpdateStatus" RENAME VALUE 'TODO' TO 'READY';
ALTER TYPE "AppUpdateStatus" ADD VALUE 'NEW' BEFORE 'STUDY';
ALTER TYPE "AppUpdateStatus" ADD VALUE 'STUDYING' AFTER 'STUDY';
ALTER TYPE "DocLinkType" ADD VALUE 'TASK';
