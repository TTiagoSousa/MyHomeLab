---
title: openGym – regras
kind: RULES
tags: [opengym, estudo, instalacao]
apps: [OPENGYM]
---
# openGym – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar openGym X → Y" em Study (o pedido de estudo do MyHomeLab).
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" (o caminho e o que decides sozinho). **Depois:** "Instalar uma atualização", mais abaixo.

No estudo só se lê e mede. Nada se instala, reinicia ou apaga.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** CT 215, servidor HomeLab. Comandos: `pct exec 215 -- <comando>`. Endereço: https://opengym.example.com.
- **Instalação:** Docker Compose com as imagens do openGym (`ghcr.io/duartesantos8/opengym-api` e `ghcr.io/duartesantos8/opengym-web`), como no guia "Self-hosting" do openGym. A pasta do projeto é a que o `docker compose ls` mostra.
- **Dados:** tudo em `./data` dentro da pasta do projeto (`DATA_DIR`): os perfis, as passkeys, os treinos e, em `data/uploads`, as fotos e os vídeos. O segredo das sessões (`data/secret`) é o que mantém válidos os tokens emparelhados (o do MyHomeLab, o da app do telemóvel).
- **Versão:** o openGym não a diz na API; o MyHomeLab lê-a na página (Definições → Sobre, "openGym vX.Y.Z"). O `/api/health` diz se o servidor responde e se o disco aceita escritas.
- **Releases:** https://github.com/DuarteSantos8/openGym/releases. As versões saem muito seguidas (várias por semana na linha 1.4).

### O que ler

1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes), não só a última. Atenção a "breaking", "migration", "docker-compose", ".env", "ORIGIN", "RP_ID", "passkey", "pair", "sync", "data".
2. As issues abertas da versão nova (update_known_issues).
3. Se as notas pedem mudanças no `docker-compose.yml` ou no `.env` (o guia diz que o `git pull` traz as do compose): `pct exec 215 -- bash -lc 'cd <pasta> && git log --oneline -1 && git status --short'` e as chaves do `.env` que mudam (`grep -n "<CHAVE>" .env`; nunca o ficheiro inteiro: tem segredos).

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · openGym", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Onde corre:** `pct exec 215 -- docker compose ls` mostra o projeto do openGym e a pasta; `docker compose ps` (nessa pasta) mostra o api e o web a correr, e se a pasta é um clone git — prova: a pasta, os serviços e as imagens (ou o que se viu, se não for Docker Compose: aí waiting, a perguntar como está instalado)
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige, em linguagem simples — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Segurança:** as falhas de segurança que corrige, com os links — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Sem issues graves abertas** na versão nova (perda de dados, sincronização, login ou passkeys, o emparelhamento da app, a importação) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Sem passos à mão:** nenhuma chave do `.env` nem do `docker-compose.yml` que tenha de mudar à mão (as do compose vêm com o `git pull`, quando a pasta é um clone) — prova: as notas e as chaves vistas (ou os passos)
- [ ] 🤖 **A ligação do MyHomeLab continua:** nada nas notas muda o `/api/pair`, o `/api/me` ou o `/api/data` (os tokens emparelhados e o formato das rotinas) — prova: as notas (ou o que muda)
- [ ] 🤖 **Há caminho de volta:** o update_run tira o snapshot do CT 215 antes de instalar, e há um backup do CT no Proxmox com menos de 24 h (ou faz-se antes de instalar) — prova: o último backup (`pvesm list <storage> --content backup --vmid 215`) ou "faz-se antes de instalar"
- [ ] 🤖 **Salto de versão major** (ex.: 1 → 2): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Pode partir:** o emparelhamento da app do telemóvel (`/api/pair`, `/api/me`, `/api/data`) ou uma chave do `.env` que muda.
- **Pergunta-se:** só se o openGym não correr por Docker Compose, ou se uma chave do `.env` tiver de mudar.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: se a ligação do MyHomeLab e a app do telemóvel continuam, e a pasta e as imagens no CT 215.

### Nunca

- Atualizar, reiniciar ou mexer no openGym durante o estudo.
- Ler o `.env` inteiro ou mostrar o segredo das sessões, tokens ou palavras-passe.

## Instalar uma atualização

> **Quando usar:** uma atualização do openGym em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu. Instala-se logo, a qualquer hora.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("Estudar uma atualização", mais acima).

Estar em Ready to update é a aprovação: não se pede outro sim, nem num salto major.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. O que se resolve dentro destas regras resolve-se e volta a medir-se. Se um ponto falhar e não se resolver, não se instala: Waiting for reply com o que falhou e as opções.

### Onde corre

- **Máquina:** CT 215, servidor HomeLab. Comandos: `pct exec 215 -- <comando>`.
- **Instalação:** Docker Compose, na pasta do projeto que o `docker compose ls` mostra (`<pasta>` nos comandos abaixo; a mesma que o estudo viu).
- **Dados:** `./data` na pasta do projeto. As imagens novas não lhe tocam; o openGym migra o que precisar ao arrancar.
- **Tokens:** o segredo das sessões (`data/secret`) mantém válidos o token do MyHomeLab e o da app do telemóvel. Perdê-lo desliga os dois.

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 A pasta do projeto: `pct exec 215 -- docker compose ls` mostra o openGym, e é a do estudo — prova: a pasta e os serviços (api e web a correr)
- [ ] 🤖 Há um backup do CT 215 no Proxmox com menos de 24 h e sem erro (`pvesm list <storage> --content backup --vmid 215`); se não, faz-se um (pve_backup_now, pelo Operador Proxmox) e espera-se que acabe bem. O snapshot de antes é o do update_run — prova: a hora e o ficheiro do backup
- [ ] 🤖 O disco do CT 215 está abaixo de 90% (`pct exec 215 -- df -h /`): as imagens novas ocupam espaço até as antigas saírem. Acima disso, pergunta-se (apagar imagens ou aumentar o disco é com o meu sim) — prova: a percentagem
- [ ] 🤖 A memória do CT 215 não está cheia — prova: a percentagem
- [ ] 🤖 O openGym responde na versão de partida (o `/api/health` ok e writable, e a versão da página) e não há outra atualização a correr no servidor — prova: a versão e o que está a correr
- [ ] 🤖 Salto de versão major: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### Instalar

Os comandos para o update_prepare, por esta ordem (`<pasta>` é a pasta do projeto vista acima). O primeiro só quando a pasta é um clone git (traz as mudanças do `docker-compose.yml`); sem git, sai da lista:

```bash
pct exec 215 -- bash -lc 'cd <pasta> && git pull --ff-only'
pct exec 215 -- bash -lc 'cd <pasta> && docker compose pull'
pct exec 215 -- bash -lc 'cd <pasta> && docker compose up -d'
```

O update_run tira o snapshot do CT 215, corre os comandos por ordem (pára no primeiro que falhar) e espera até 5 minutos que o openGym responda na versão nova. Se falhar, volta sozinho ao snapshot.

Nunca `docker compose restart`: não lê o `.env` outra vez (o guia do openGym diz `up -d`).

### Depois de instalar
- [ ] 🤖 O openGym responde na versão nova (a página) e o `/api/health` diz ok e writable — prova: a versão, o JSON e o tempo que levou
- [ ] 🤖 Os dois serviços estão a correr: `pct exec 215 -- bash -lc 'cd <pasta> && docker compose ps'` — prova: o estado do api e do web
- [ ] 🤖 Sem erros novos no log desde o arranque (`pct exec 215 -- bash -lc 'cd <pasta> && docker compose logs --since 15m --no-color api'`) — prova: as linhas ou "nenhuma"
- [ ] 🤖 A ligação do MyHomeLab continua e os dados estão lá: opengym_overview mostra as mesmas rotinas e os mesmos treinos de antes — prova: os números antes e depois
### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Onde ver:** a saída do comando que falhou e `docker compose logs --tail 50 api`.
- **Contorna-se:** uma imagem que não desceu à primeira (`docker compose pull` outra vez), ou falta de espaço que se liberta com `docker image prune -f`.

### Nunca

- Instalar sem o backup do CT das últimas 24 h ou sem o snapshot.
- Apagar a pasta `data` (nem o `data/secret`), volumes ou imagens.
- Mexer no `.env` ou no `docker-compose.yml` à mão durante a atualização.
- `docker compose down -v` ou outro comando que apague volumes.
- Mostrar o segredo das sessões, tokens ou palavras-passe.
