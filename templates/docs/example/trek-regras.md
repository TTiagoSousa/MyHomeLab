---
title: TREK – regras
kind: RULES
tags: [trek, estudo, instalacao]
apps: [TREK]
---
# TREK – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar TREK X → Y" em Study (o pedido de estudo do MyHomeLab).
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" (o caminho e o que decides sozinho). **Depois:** "TREK – instalar uma atualização".

No estudo só se lê e mede. Nada se instala, reinicia ou apaga.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** CT 214 (`trek`), servidor HomeLab, 192.168.1.23. Comandos: `pct exec 214 -- <comando>`. Endereço: https://trek.example.com.
- **Instalação:** Docker Compose, projeto `trek` em `/opt/trek` (`docker-compose.yml`), um só contentor `trek` com a imagem `mauriceboe/trek:latest`. A pasta não é um clone git: o compose não muda sozinho.
- **Dados:** `/opt/trek/data` (a base de dados SQLite e a chave de encriptação) e `/opt/trek/uploads` (fotos e ficheiros), em bind mounts. Sem a chave de encriptação, os segredos guardados no TREK (chaves do Immich, AirTrail, IA, clientes MCP) deixam de se ler.
- **Variáveis do compose:** `ALLOW_INTERNAL_NETWORK=true` (para chegar ao Immich da rede interna). Mudar outras só com o meu sim.
- **Ligações do MyHomeLab:** a conta de admin (versão, backups) e o **cliente máquina do MCP** (`/oauth/token` + `/mcp`), que dá ao Agente de Viagens a API toda.
- **Versão:** o MyHomeLab lê-a no TREK; as releases estão em https://github.com/liketrek/TREK/releases (o repositório passou de `mauriceboe/TREK` para `liketrek/TREK`; o GitHub redireciona).
- **Backups:** o TREK faz os seus (`trekBackups` na página da app) e o MyHomeLab pede-lhe um zip novo (base de dados, uploads e a chave de encriptação) e guarda-o no Nextcloud, em Backups/Trek.

### O que ler

1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes), não só a última. Cada uma tem "Changed": é aí que vêm as migrações e o que muda por omissão. Atenção a "breaking", "migration", "database", "env", "docker", "image", "MCP", "OAuth", "API", "encryption", "backup".
2. As issues abertas da versão nova (update_known_issues).
3. **O nome da imagem:** se as notas ou o README dizem que a imagem Docker mudou de nome (ex.: de `mauriceboe/trek` para `liketrek/trek`), isso é um passo à mão no `docker-compose.yml`. Ver em `pct exec 214 -- bash -lc 'cd /opt/trek && grep -n image docker-compose.yml'`.
4. As variáveis novas que as notas pedem ou que mudam um comportamento por omissão (ex.: `TREK_SERVICES`, `TREK_PLACES_ENABLED`): `pct exec 214 -- bash -lc 'cd /opt/trek && grep -n "<CHAVE>" docker-compose.yml .env 2>/dev/null'`. Nunca o ficheiro inteiro: pode ter segredos.

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · TREK", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Onde corre:** `pct exec 214 -- docker compose ls` mostra o projeto `trek` em `/opt/trek`; `docker compose ps` mostra o contentor `trek` healthy, a imagem e a data dela — prova: a pasta, o estado e a imagem (ou o que se viu, se mudou: aí waiting, a perguntar)
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige, em linguagem simples (viagens, mapas, reservas, o MCP dos agentes) — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Segurança:** as falhas de segurança que corrige (os GHSA, e as do Node.js), com os links — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Sem issues graves abertas** na versão nova (perda de dados, migração, login ou OIDC, o MCP/OAuth, a encriptação, os backups) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Sem passos à mão:** a imagem continua com o mesmo nome e nenhuma variável do compose tem de mudar — prova: as notas e as linhas vistas (ou os passos)
- [ ] 🤖 **As ligações do MyHomeLab continuam:** nada nas notas muda o login de admin, os backups (`/api/backup`), o `/oauth/token` (`client_credentials`), o `/mcp` nem os escopos — prova: as notas (ou o que muda; um escopo ou ferramenta que saia é dito no relatório)
- [ ] 🤖 **Espaço para a migração:** o TREK copia a base de dados antes de migrar; o disco do CT 214 tem de ter folga (`pct exec 214 -- df -h /` e `du -sh /opt/trek/data /opt/trek/uploads`) — prova: o livre e o tamanho dos dados
- [ ] 🤖 **O backup do TREK está ativo** (list_backups): ligado, com destino, sem erro e **já correu bem pelo menos uma vez** — prova: o backup, o destino, a última corrida e o estado
- [ ] 🤖 **Salto de versão major** (ex.: 4 → 5): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Pode partir:** o login de admin, os backups, o `/oauth/token`, o `/mcp` ou os escopos que os agentes usam, ou a falta de espaço para a migração.
- **Pergunta-se:** só se a imagem mudar de nome, ou se aparecer uma variável nova que mude a privacidade.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: se o login, os backups e o MCP dos agentes continuam, e o espaço no CT 214.

### Nunca

- Atualizar, reiniciar ou mexer no TREK durante o estudo.
- Ler o `.env` ou o compose inteiros, ou mostrar a chave de encriptação, tokens, segredos de clientes ou palavras-passe.

## Instalar uma atualização

> **Quando usar:** uma atualização do TREK em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu. Instala-se logo, a qualquer hora.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("TREK – estudar uma atualização").

Estar em Ready to update é a aprovação: não se pede outro sim, nem num salto major.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. O que se resolve dentro destas regras resolve-se e volta a medir-se. Se um ponto falhar e não se resolver, não se instala: Waiting for reply com o que falhou e as opções.

### Onde corre

- **Máquina:** CT 214 (`trek`), servidor HomeLab. Comandos: `pct exec 214 -- <comando>`.
- **Instalação:** Docker Compose em `/opt/trek`, contentor `trek`, imagem `mauriceboe/trek:latest` (a etiqueta `latest` traz a versão nova com o `pull`).
- **Dados:** `/opt/trek/data` e `/opt/trek/uploads` (bind mounts). A imagem nova não lhes toca; o TREK copia a base de dados e migra-a ao arrancar.

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 O projeto: `pct exec 214 -- docker compose ls` mostra o `trek` em `/opt/trek`, e o contentor está healthy — prova: a pasta e o estado
- [ ] 🤖 A imagem no compose é a que o estudo viu, e o estudo não pediu passos à mão (ou já foram feitos com o meu sim) — prova: a linha `image:`
- [ ] 🤖 O backup do TREK está ativo: ligado, com destino e sem erro (list_backups). Se não estiver, não se configura: pergunta-se — prova: o backup, o destino e o estado
- [ ] 🤖 Há um backup do TREK feito pelo MyHomeLab **há menos de 1 hora**, sem erro (o zip traz a base de dados, os uploads e a chave de encriptação); se não, corre-o (run_backup) e espera que acabe — prova: a hora, o ficheiro e o tamanho
- [ ] 🤖 O disco do CT 214 está abaixo de 85% (`pct exec 214 -- df -h /`): a imagem nova e a cópia da base de dados ocupam espaço. Acima disso, pergunta-se (apagar imagens ou aumentar o disco é com o meu sim) — prova: a percentagem
- [ ] 🤖 A memória do CT 214 não está cheia — prova: a percentagem
- [ ] 🤖 O TREK responde na versão de partida e não há outra atualização a correr no servidor — prova: a versão e o que está a correr
- [ ] 🤖 Antes, para comparar depois: trek_overview (a versão, o MCP ligado e quantas ferramentas, e as viagens) — prova: os números
- [ ] 🤖 Salto de versão major: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### Instalar

Os comandos para o update_prepare, por esta ordem:

```bash
pct exec 214 -- bash -lc 'cd /opt/trek && docker compose pull'
pct exec 214 -- bash -lc 'cd /opt/trek && docker compose up -d'
```

O update_run tira o snapshot do CT 214, corre os comandos por ordem (pára no primeiro que falhar) e espera até 5 minutos que o TREK responda na versão nova (num salto major a migração pode levar mais um pouco). Se falhar, volta sozinho ao snapshot.

Nunca `docker compose restart`: não lê o compose outra vez. Nunca `down -v`.

### Depois de instalar
- [ ] 🤖 O TREK responde na versão nova e o contentor está healthy (`pct exec 214 -- bash -lc 'cd /opt/trek && docker compose ps'`) — prova: a versão, o estado e o tempo que levou
- [ ] 🤖 A migração correu: sem erros no log desde o arranque (`pct exec 214 -- bash -lc 'cd /opt/trek && docker compose logs --since 15m --no-color trek'`; procurar "migration", "error", "failed") — prova: as linhas ou "nenhuma"
- [ ] 🤖 O login de admin do MyHomeLab continua (a página da app sem erro, trek-status) — prova: o estado
- [ ] 🤖 O MCP dos agentes continua: trek_overview mostra o MCP ligado e as ferramentas (o número pode subir; se descer, diz quais saíram) e as mesmas viagens de antes — prova: os números antes e depois
- [ ] 🤖 Os segredos guardados lêem-se: o Immich continua "Conectado" em Definições → Integrações (sinal de que a chave de encriptação veio intacta) — prova: o teste da ligação, ou "por confirmar por mim" se não se consegue ver
- [ ] 🤖 Correu um backup novo pelo MyHomeLab, sem erro — prova: a hora, o tamanho e o resultado
- [ ] 🤖 Se as notas pediam um passo depois de atualizar (ex.: na 5.1, fazer uma pesquisa de sítio para registar a instalação), fez-se — prova: o passo e o resultado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Onde ver:** a saída do comando que falhou e `docker compose logs --tail 50 trek`.
- **Contorna-se:** uma imagem que não desceu à primeira, falta de espaço que se liberta com `docker image prune -f`, ou um arranque lento (esperar mais pelo `/api/health`). Mudar a imagem ou as variáveis do compose é comigo.

### Nunca

- Instalar sem o backup da última hora ou sem o snapshot.
- Apagar `/opt/trek/data`, `/opt/trek/uploads`, a cópia `data.bak-*`, volumes ou imagens.
- Mudar a imagem ou as variáveis do compose à mão sem o meu sim.
- `docker compose down -v` ou outro comando que apague volumes.
- Mostrar a chave de encriptação, tokens, segredos de clientes ou palavras-passe.
