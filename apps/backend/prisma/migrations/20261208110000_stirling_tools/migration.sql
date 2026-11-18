-- O Arquivista recebe as ferramentas do Stirling-PDF (tratar os PDFs do Paperless e do Nextcloud).
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['stirling_overview', 'stirling_operations', 'stirling_describe', 'stirling_results', 'stirling_settings', 'stirling_run', 'stirling_set_settings']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'archivist' AND NOT ('stirling_overview' = ANY("tools"));
