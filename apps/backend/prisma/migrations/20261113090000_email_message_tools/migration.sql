-- O Assistente Administrativo passa a ler emails inteiros e anexos, escrever rascunhos,
-- enviar (com o sim do utilizador), mexer em emails concretos e mandar para o lixo.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['read_email', 'read_email_attachment', 'draft_email', 'send_email_draft', 'modify_email', 'trash_email']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'admin' AND NOT ('read_email' = ANY("tools"));
