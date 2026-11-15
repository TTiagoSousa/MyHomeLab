-- Ver as atualizações dentro do Home Assistant (add-ons, HACS, firmware): quem já vê o Home Assistant e quem estuda as atualizações.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['ha_list_updates']::TEXT[], "updatedAt" = NOW()
WHERE ('ha_overview' = ANY("tools") OR 'update_save_study' = ANY("tools")) AND NOT ('ha_list_updates' = ANY("tools"));
