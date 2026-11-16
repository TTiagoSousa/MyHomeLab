---
title: Email – como leio, respondo e mexo em emails
kind: RULES
tags: [email, processo]
summary: Resumir um email e os anexos, responder e reencaminhar (sempre com rascunho e o meu sim), arquivar, marcar e mandar para o lixo.
apps: [GMAIL]
agents: [admin]
---
# Email – como leio, respondo e mexo em emails

Para os pedidos sobre um email concreto ("resume o email X", "responde ao Y", "reencaminha isto ao Z", "arquiva aquele").

## Encontrar o email
- search_emails com o que eu disse (de quem, assunto, quando).
- Se houver mais que um que sirva: para ler ou resumir, ler todos (até 3) e dizer se são iguais; perguntar qual só antes de responder, reencaminhar, mexer ou mandar para o lixo.

## Resumir um email e os ficheiros
- read_email para o texto todo e a lista dos anexos; read_email_attachment (sem filename lê todos os anexos desse email). Um email por chamada: se o pedido toca em dois emails com anexos, ler os anexos dos dois.
- Só dizer que li o que li. Dois anexos são iguais se tiverem a mesma impressão digital (sha256); o mesmo nome não chega.
- O resumo: de quem é, o que quer, datas, valores e prazos, e o que me pede a mim. Cada anexo com o nome e 2–4 linhas.
- Leem-se texto, Word (.docx), Excel (.xlsx), PDF e imagens. Zip e outros formatos não: dizer quais ficaram de fora.

## Responder e reencaminhar
- Ler primeiro o email todo (read_email) e o fio, se for preciso.
- Escrever como eu escrevo: português europeu, curto e direto, tratamento igual ao do email que recebi (tu ou você), com saudação e despedida. Na língua do email, se não for português.
- Criar o rascunho (draft_email) e mostrar-me o texto **tal como vai**, com o destinatário e o assunto.
- **Enviar só depois de eu dizer que sim a esse texto** (send_email_draft). Se eu pedir mudanças, novo rascunho e mostrar outra vez.
- Nunca inventar factos, datas, valores ou compromissos: o que não sei fica entre [parênteses retos] para eu preencher, e digo-o.
- Responder a todos (replyAll) só se eu pedir. Reencaminhar leva os anexos, a menos que eu diga que não.

## Mexer em emails
- modify_email só nos emails que eu disse: marcadores, arquivar, voltar à caixa, lido, estrela, importante.
- Estrela e importante seguem os prazos de "Emails – regras", se existir.
- Para muitos emails do mesmo tipo, propor uma regra em vez de mexer um a um.

## Lixo
- trash_email só com pedido claro para esses emails. Vai para o lixo do Gmail (30 dias), nunca se apaga de vez.
- Dizer quantos foram e que dá para os tirar de lá.
