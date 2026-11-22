---
title: Email – como trato as regras do Gmail
kind: RULES
tags: [email, regras do gmail, processo]
summary: Criar, mudar e propor regras do Gmail sem choques nem duplicados, os emails de validação e como as regras dizem o que é importante.
apps: [GMAIL]
agents: [admin]
---
# Email – como trato as regras do Gmail

As regras de email são decisões minhas sobre como tratar cada tipo de email. Mandam sobre as preferências do agente.

## Como é uma regra
- Respeitar as regras atuais: uma regra nova encaixa no que já existe, não o contradiz nem o repete.
- Condições: palavras-chave (keywords) e remetentes (fromContains) primeiro; o assunto (subjectContains) só quando for preciso para separar emails do mesmo remetente.
- Marcadores sempre, com o caminho completo e a passar por todas as camadas (labelMode ALL_LEVELS): "Finanças/Bancos/Banco X" põe "Finanças", "Finanças/Bancos" e "Finanças/Bancos/Banco X". Usar os caminhos que já existem antes de criar novos.

## Emails de validação
- Códigos de início de sessão, códigos de verificação, tokens e links de autenticação, confirmações de email e afins ficam 1 dia na caixa de entrada e depois saem (removeFromInbox com removeFromInboxAfterDays = 1), sempre com o marcador deles.
- Nunca os marcar como lidos logo nem arquivá-los na hora: posso precisar do código nesse dia.

## Mexer em regras
- Nunca apagar, desligar nem mudar uma regra sem eu pedir essa regra. Ao mudar, só o que pedi.
- Antes de criar ou mudar: ver as regras (list_email_rules) e procurar choques — o mesmo remetente ou assunto com outros marcadores, uma que arquiva o que outra mantém, uma que marca como lido o que outra destaca. As regras correm por ordem e todas as que coincidem atuam (menos com stopProcessing).
- Se houver choque, não criar nada: dizer qual é a regra, o que cada uma faria ao mesmo email e perguntar.
- Não duplicar: se já há regra para aquele remetente ou assunto, propor mudar essa.
- Antes de propor algo para um email, ver os marcadores dele e se está na caixa de entrada (read_email). Se já tem o marcador de uma regra, a regra funcionou: dizer qual e não propor nada. Se uma regra do mesmo remetente e tipo não o apanhou, dizer a condição que falhou e propor só juntar essa condição, sem mudar o marcador nem a retenção.
- Não renomear marcadores que já uso. Um marcador novo segue o formato e o detalhe dos que já existem para emails parecidos (ver os da mesma categoria), nunca um nome genérico como "Mensagens".
- Seguir a minha maneira: copiar a combinação de ações que já uso em emails parecidos e dizer que regra serviu de modelo.
- Apagar não se desfaz: só com pedido claro. Depois de criar ou mudar, dizer o que ficou.

## Propor regras
- Sempre com os números da caixa (analyze_inbox) — nunca de cabeça.
- Não propor o que já está coberto; prioridade aos remetentes sem regra com mais emails e aos que acumulam por ler.
- Pensar no efeito real (marcar como lido logo e arquivar dias depois não serve de nada).
- Propostas numeradas, cada uma com o motivo em números e o que faria; criar só as que eu escolher.

## Ler emails
- As regras dizem o que é importante: o que arquivam ou marcam como lido é secundário; o que marcam como importante ou com estrela vem primeiro.
- O cartão "Regras propostas" é outro sistema: só aceitar ou recusar as que eu disser.
