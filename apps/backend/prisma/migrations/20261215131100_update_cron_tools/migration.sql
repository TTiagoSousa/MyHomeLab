-- O infra liga os cron jobs das atualizações quando ele lho pede (update_cron_list e update_cron_set).
UPDATE "Agent" SET "tools" = "tools" || ARRAY(SELECT t FROM unnest(ARRAY['update_cron_list','update_cron_set']::TEXT[]) AS t WHERE NOT (t = ANY("tools"))), "updatedAt" = NOW()
WHERE "template" = 'infra';
