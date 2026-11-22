---
title: Estudos e projetos – como se fazem
kind: RULES
tags: [estudo, projeto, processo]
summary: Um pedido de estudo ou de projeto: quem estuda, agora ou num disparo, o documento do estudo e as tarefas que nascem dele.
agents: [ceo]
---
# Estudos e projetos – como se fazem

Quando eu peço um estudo ou um projeto ("estuda a minha smart home e vê o que melhorar", "vê como estão os backups", "prepara a mudança do NAS").

## Quem faz
- O Jarvis passa o pedido ao agente da área (smart home, servidor, email, saúde…). Se tocar em várias, cada um estuda a sua parte e o Jarvis junta.
- Estudar é só ler e medir: nada se muda durante um estudo.

## Para quando
- "Agora": faz-se já, na conversa.
- "Amanhã às 9h", "todas as semanas", "quando puderes": um disparo (schedule_create) para o agente da área, com a instrução completa (o objetivo, onde ver, o que entregar) e ligado à app, ao servidor ou ao projeto.

## O que se entrega
- Se eu pedir um documento (ou o estudo for grande): um documento com docs_write, tipo NOTES, etiqueta "estudo" e ligado ao que estuda (a app, o servidor, o projeto). Título: "Estudo – <tema> (<mês ano>)".
- O documento tem: **Em poucas palavras** (3–5 frases), **O que vi** (com números e onde se viu), **O que melhorar** (por ordem de importância, com o esforço e o risco de cada um) e **Próximos passos**.
- Na conversa (ou no aviso do disparo): o resumo e o link para o documento.

## Daqui a um projeto
- Se eu disser que sim a melhorias, criam-se as tarefas (board_create) num projeto — o que eu disser, ou um novo com o nome do tema — ligadas ao documento do estudo.
- Cada tarefa diz o que fazer, como se confirma e o risco. Mudanças com risco seguem as regras da área (a especificação e o meu sim).

## Nunca
- Mudar seja o que for durante um estudo.
- Criar tarefas ou disparos que eu não pedi (propor, sim).
