---
title: Serviço em baixo – como se trata
kind: RULES
tags: [servicos, falha, processo]
summary: Quando um serviço vigiado cai: ver como está, procurar a causa com leituras, reiniciar o serviço uma vez se parou; máquinas e o resto só com o meu sim.
agents: [infra]
---
# Serviço em baixo – como se trata

> **Quando usar:** uma tarefa "Serviço X falhou", que o MyHomeLab cria em Todo, no projeto do servidor, quando um serviço vigiado (Serviços) deixa de responder duas vezes seguidas. O disparo "Estudar a falha de X" traz-te aqui.
> **Não serve para:** atualizações (essas seguem "Atualizações das apps e do Proxmox – como funcionam").

O aviso de serviço em baixo já me chega sozinho (e fecha-se quando volta). Tu descobres a causa e resolves o que estas regras deixam; só me perguntas o resto.

🤖 o agente faz · 👤 só eu decido

## 1. Ver como está agora

- Ler a tarefa (board_get): a hora, o erro (ex.: 502, sem resposta), o servidor e a máquina. Um comentário "Voltou a responder às …" quer dizer que já voltou.
- Medir agora: o serviço responde no mesmo endereço?

## 2. Procurar a causa (só leituras)

- A máquina (CT ou VM) está ligada? Reiniciou (`uptime`)? Tem memória e disco livres?
- O serviço está ativo (`systemctl status <serviço>`)? O que dizem os logs à volta da hora da falha (`journalctl -u <serviço> --since …`, o nginx, o log da app)?
- Havia alguma coisa a correr nessa hora: uma atualização, um backup, um snapshot, um rollback? (updates_list, as tarefas do Proxmox — `pvesh get /nodes/<nó>/tasks --limit 20` mostra os vzdump e os snapshots — e o histórico de comandos.)

## 3. Resolver ou dizer

- **Já voltou e a causa é clara** (ex.: uma atualização, um rollback, um backup): comentário com a causa e o tempo em baixo, e passa a **Done**. Não me chega aviso.
- **Já voltou mas a causa não é clara:** comentário com o que se viu e passa a **Done**; se for a terceira vez em 7 dias, fica em Todo e pergunta-se (board_ask_user) se vale a pena investigar mais.
- **Continua em baixo e o serviço parou** (a máquina está bem, os logs mostram o serviço parado ou em erro): podes reiniciar **o serviço**, uma vez (`systemctl restart <serviço>`, dentro da máquina). Voltou → comentário e Done. Não voltou → board_ask_user com o que se vê e o que recomendas.
- **Continua em baixo por outra razão** (máquina desligada, disco cheio, memória cheia): board_ask_user com **uma pergunta**: o que se vê e o que recomendas.

## Nunca

- 👤 Reiniciar, ligar ou parar máquinas (CT, VM, o host), mudar configurações ou voltar a um snapshot sem o meu sim.
- Reiniciar o mesmo serviço mais do que uma vez.
- Apagar ficheiros para libertar espaço sem o meu sim.
- Mostrar palavras-passe, tokens ou chaves.
