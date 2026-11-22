---
title: Mapa do servidor – como se escreve
kind: RULES
tags: [servidores, guia]
summary: Como ler um servidor só com leituras e escrever o guia dele (como está montado e funciona, sem apontar problemas). Não é sobre atualizações.
server: true
---
# Mapa do servidor – como se escreve

> **Quando usar:** quando eu peço "estuda o servidor" ou "atualiza o mapa do <nome>", ou quando um mapa falta ou está desatualizado.
> **Não serve para:** atualizações (essas seguem "Atualizações das apps e do Proxmox – como funcionam").

Como o agente lê um servidor e escreve o mapa dele ("Mapa do servidor <nome>"). Não é sobre atualizações: essas seguem "Atualizações das apps e do Proxmox – como funcionam" e o "Proxmox – regras". Vale quando eu peço "estuda o servidor", "atualiza o mapa do <nome>" ou quando um mapa falta ou está desatualizado.

**O mapa descreve como o servidor está montado e como funciona.** É um mapa, não uma auditoria: não aponta problemas, não dá notas nem recomenda correções. Os números ficam como estão (ex.: "disco 30 GiB, 25 usados"), sem juízos como "quase cheio" ou "em risco".

**Estudar é só ler.** Nada se muda, reinicia, instala ou apaga durante um estudo.

## Antes de começar

- [ ] Ver se já há um mapa ligado ao servidor (docs_search) e lê-lo: o estudo atualiza-o, não começa do zero.
- [ ] Ver os últimos comandos corridos (server_command_history), para saber o que mudou desde o último estudo.

## O que ver, por ordem

1. **O inventário**: começar sempre por `server_inventory`. Dá o host, os discos, os storages, a rede, os serviços, os backups e cada CT e VM.
2. **O host**: versão do Proxmox, CPU e RAM, discos e como estão organizados (pools ZFS, LVM, storages e o que cada um guarda), rede (bridges, IPs, VLANs). Se houver cluster, `pvecm status`; se houver Ceph, `ceph status`.
3. **As máquinas** (cada CT e VM): para que serve, recursos (CPU, RAM, disco), IP, se arranca sozinha e por que ordem, o que corre lá dentro (serviços, contentores Docker) e em que portas.
4. **Cada app importante**: onde corre, a porta, onde ficam os dados e a configuração, onde estão os logs e como se gere (o nome do serviço systemd ou do contentor e, no Docker, a pasta do Compose).
5. **Como as peças se ligam**: o DNS, o proxy e os domínios (o caminho de um pedido de fora até à app), as bases de dados partilhadas e que apps as usam, o que depende de quê.
6. **Os backups**: que tarefas existem, o que cobrem, para onde vão e quando correm.

## Os comandos

- Para aprofundar o que o inventário deixar em aberto, usar `server_run_command` só com **comandos simples de leitura**: `cat`, `ls`, `grep`, `head`, `tail`, `df`, `du`, `lsblk`, `ip`, `ss`, `systemctl status|show|cat`, `journalctl`, `docker ps|inspect|logs`, `pct config|list`, `qm config|list`, `qm guest cmd <vmid> network-get-interfaces`, `pvesm status`. Dentro de uma VM, os mesmos com `qm guest exec <vmid> --timeout 60 -- <comando>`, `zpool status`, `zfs list`, `smartctl -a`. Dentro de um CT: `pct exec <vmid> -- <comando>`.
- Um comando de cada vez, com a razão. Até 15–20 comandos por estudo.
- **Interpretadores e scripts contam sempre como alteração**: `python`, `python3`, `node`, `perl`, `php`, `bash -c`, `sh -c`, `sqlite3`, `psql`, `mysql`, `awk` com `system`. O MyHomeLab não sabe se só leem e faz antes um snapshot da máquina. Num estudo, não se usam: lê os ficheiros de configuração com `cat`/`grep`; se a informação só estiver numa base de dados, diz no mapa que ficou por ver.
- Se a resposta de um comando disser que o MyHomeLab fez um snapshot antes de correr, o comando contou como alteração: diz qual foi no relatório e continua só com comandos da lista acima.

## Nunca durante um estudo

- Comandos que mudam alguma coisa: `restart`, `stop`, `apt`, `rm`, `mv`, editar ficheiros, `pct set`, `qm set`, snapshots, backups.
- Mostrar no mapa ou no chat palavras-passe, tokens, chaves ou o conteúdo de ficheiros `.env`. Se um ficheiro os tiver, diz só que existe e onde.

## O mapa

- **Nome:** "Mapa do servidor <nome>", tipo **Mapa**.
- **Etiquetas:** `servidor`, `mapa` e o nome do servidor em minúsculas (ex.: `homelab`).
- **Ligações:** o servidor (SERVER, com o id que vem em list_servers) e este documento (DOC). As máquinas (GUEST, `<id do servidor>:<vmid>`) só se eu pedir.
- **Formato:** Markdown, secções `##` pela ordem acima, uma tabela das máquinas (ID, nome, tipo, para quê, IP, recursos, arranque), frases curtas.
- **Só o que se viu.** O que for suposição fica marcado como "(a confirmar)"; o que ficou por ver vai para uma secção "Por ver", no fim.
- **Sem secções de riscos, problemas, prioridades ou recomendações**, e sem a lista dos comandos corridos (essa já fica registada no MyHomeLab).
- **O mapa fala do servidor, não do estudo.** Nada de âmbito, validação, "diferenças face à versão anterior", horas do levantamento ou quantos comandos se correram: isso vai para o relatório no chat.
- **Cada coisa diz-se uma vez, como é.** Sem ressalvas como "não relido", "preservado da versão anterior", "não prova" ou "não demonstra". O que não se confirmou leva "(a confirmar)" uma vez; o que não se viu vai só para "Por ver".
- **Gravar:**
  - se não existe, criar com docs_write;
  - se existe e é dos agentes, reescrever com docs_write;
  - se é meu, propor a mudança com docs_propose.
- Um estudo não escreve registo (docs_log). Se uma regra deste documento estiver errada, propõe uma versão nova dele (docs_propose).

## Depois do estudo

- [ ] O mapa está gravado antes do relatório — prova: o nome do mapa.
- [ ] Nenhum comando do estudo mudou nada — prova: nenhum aviso de snapshot nas respostas.
- [ ] Relatório no chat, curto: o nome do mapa, o que mudou desde a versão anterior e o que ficou "Por ver". Sem problemas nem recomendações.
