-- As contas Nextcloud passam a ter a raiz em baseUrl (versão, apps e CalDAV); vem do caldavUrl.
UPDATE "ConnectedAccount"
SET "baseUrl" = regexp_replace(regexp_replace("caldavUrl", '/(remote|index)\.php(/.*)?$', '', 'i'), '/+$', '')
WHERE "provider" = 'NEXTCLOUD' AND "baseUrl" IS NULL AND "caldavUrl" IS NOT NULL;
