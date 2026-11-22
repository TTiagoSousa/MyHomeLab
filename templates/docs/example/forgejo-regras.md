---
title: Forgejo – regras
kind: RULES
tags: [forgejo, estudo, instalacao]
apps: [FORGEJO]
---
# Forgejo – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar Forgejo X → Y" em Study (o pedido de estudo do MyHomeLab).
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" (o caminho e o que decides sozinho). **Depois:** "Forgejo – instalar uma atualização".

No estudo só se lê e mede. Nada se instala, reinicia ou apaga.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** CT 213 `forgejo` (192.168.1.22), servidor HomeLab. Comandos: `pct exec 213 -- <comando>`.
- **Instalação:** binário em `/opt/forgejo/forgejo` (ligado a `/usr/local/bin/forgejo`), serviço `forgejo.service`, porta 3000, configuração `/etc/forgejo/app.ini`.
- **Dados:** SQLite em `/var/lib/forgejo/data/forgejo.db`, repositórios em `/var/lib/forgejo/data/forgejo-repositories`, LFS em `/var/lib/forgejo/data/lfs`. Os logs vão para o journal (`journalctl -u forgejo`).
- **Sem runners:** não há forgejo-runner nem act_runner; os pontos dos runners marcam-se "não se aplica".
- **Mirrors:** os repositórios `starred/*` são mirrors do GitHub, alimentados pelo CT gitea-mirror.
- **Linha:** a 15 é LTS. Uma versão de correção da linha instalada (ex.: 15.0.x) é sempre mais segura do que saltar de major.

### O que ler

1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes), não só a última. Atenção a "breaking", "migration", "app.ini", "mirror", "security".
2. As issues abertas da versão nova (update_known_issues) e os avisos no blog do Forgejo.
3. As chaves do `app.ini` que as notas dizem que mudam: `pct exec 213 -- grep -n "<CHAVE>" /etc/forgejo/app.ini` (nunca o ficheiro inteiro: tem segredos).

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · Forgejo", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige, em linguagem simples — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Segurança:** as falhas de segurança que corrige, com os links — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Sem issues graves abertas** na versão nova (perda de dados, migração partida, login, git push/pull, mirrors) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Sem passos à mão:** nenhuma chave do `app.ini` que tenha de mudar — prova: as chaves vistas (ou os passos)
- [ ] 🤖 **Mirrors:** o que muda nos mirrors e se toca os `starred/*` — prova: as notas (ou "não muda")
- [ ] 🤖 **O backup do Forgejo está ativo** (list_backups): ligado, com destino e sem erro — prova: o backup, o destino e o estado
- [ ] 🤖 **Salto de versão major** (ex.: 15 → 16): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Pode partir:** os mirrors (`starred/*`), uma chave do `app.ini` que muda, ou a migração da base de dados.
- **Pergunta-se:** só se uma chave do `app.ini` tiver de mudar e não estiver nas regras.
- **Alternativa melhor** (ex.: uma versão mais nova da mesma linha LTS): diz-se no resumo; instala-se a da tarefa.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: o que muda nos mirrors e quanto tempo deve demorar.

### Nunca

- Atualizar, reiniciar ou mexer no Forgejo durante o estudo.
- Ler o `app.ini` inteiro ou mostrar tokens e palavras-passe.

## Instalar uma atualização

> **Quando usar:** uma atualização do Forgejo em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu. Instala-se logo, a qualquer hora.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("Forgejo – estudar uma atualização").

Estar em Ready to update é a aprovação: não se pede outro sim, nem num salto major.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. O que se resolve dentro destas regras resolve-se e volta a medir-se. Se um ponto falhar e não se resolver, não se instala: Waiting for reply com o que falhou e as opções.

### Onde corre

- **Máquina:** CT 213 `forgejo` (192.168.1.22), servidor HomeLab. Comandos: `pct exec 213 -- <comando>`.
- **Binário:** `/opt/forgejo/forgejo` (ligado a `/usr/local/bin/forgejo`). Serviço `forgejo.service`, porta 3000.
- **Dados:** SQLite em `/var/lib/forgejo/data/forgejo.db`. A base de dados migra sozinha no primeiro arranque da versão nova e **não volta atrás** sem o snapshot.
- **Cache que se pode limpar:** `/var/lib/forgejo/data/repo-archive` (os zip/tar/bundle dos repositórios, que o Forgejo volta a gerar). O backup do MyHomeLab limpa-a sozinho, antes e no fim, pelo cron do Forgejo (`delete_repo_archives`), que apaga os ficheiros **e** os registos deles na base de dados.
- **Sem runners:** os pontos dos runners marcam-se "não se aplica".

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 O backup do Forgejo está ativo: ligado, com destino (Nextcloud) e sem erro (list_backups). Se não estiver, não se configura: pergunta-se — prova: o backup, o destino e o estado
- [ ] 🤖 Não há CI a correr (forgejo_list_action_runs); sem runners, "não se aplica" — prova: as corridas vistas
- [ ] 🤖 O disco do CT 213 está abaixo de 90% (`pct exec 213 -- df -h /var/lib/forgejo`). Se estiver acima por causa da cache (`du -sh` da `repo-archive`), corre-se o backup (run_backup), que a limpa, e mede-se outra vez (o ZFS pode levar uns segundos a mostrar o espaço livre). Só se o backup não a limpar (a conta do Forgejo não é admin), já autorizei limpá-la à mão, e só essa pasta: `pct exec 213 -- find /var/lib/forgejo/data/repo-archive -mindepth 1 -delete`. Se continuar acima, pergunta-se (aumentar o disco é com o meu sim) — prova: as percentagens e o tamanho da cache, antes e depois
- [ ] 🤖 Há um backup do Forgejo feito pelo MyHomeLab **há menos de 1 hora**, sem erro e **sem nada "de fora"** (o run_backup e o list_backups dizem "ficou de fora: …"); se não, corre-o (run_backup) e espera que acabe. Um backup com repositórios de fora não conta: corre-se outra vez, uma vez; se continuar, pergunta-se — prova: a hora, o ficheiro e o tamanho
- [ ] 🤖 A memória do CT 213 não está cheia — prova: a percentagem
- [ ] 🤖 O Forgejo responde na versão de partida e não há outra atualização a correr no servidor — prova: a versão e o que está a correr
- [ ] 🤖 Salto de versão major: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### Instalar

Os comandos para o update_prepare, por esta ordem (`<v>` é a versão nova, sem o "v"):

```bash
pct exec 213 -- bash -lc 'cd /tmp && wget -q -O forgejo-<v>-linux-amd64 https://codeberg.org/forgejo/forgejo/releases/download/v<v>/forgejo-<v>-linux-amd64 && wget -q -O forgejo-<v>-linux-amd64.sha256 https://codeberg.org/forgejo/forgejo/releases/download/v<v>/forgejo-<v>-linux-amd64.sha256'
pct exec 213 -- bash -lc 'cd /tmp && sha256sum -c forgejo-<v>-linux-amd64.sha256'
pct exec 213 -- systemctl stop forgejo
pct exec 213 -- install -m 0755 -o root -g root /tmp/forgejo-<v>-linux-amd64 /opt/forgejo/forgejo
pct exec 213 -- systemctl start forgejo
pct exec 213 -- rm -f /tmp/forgejo-<v>-linux-amd64 /tmp/forgejo-<v>-linux-amd64.sha256
```

O update_run tira o snapshot do CT 213, corre os comandos por ordem (pára no primeiro que falhar) e espera até 5 minutos que o Forgejo responda na versão nova. Se falhar, volta sozinho ao snapshot.

### Depois de instalar
- [ ] 🤖 O Forgejo responde na versão nova — prova: a versão e o tempo que levou
- [ ] 🤖 Sem erros novos no log desde o arranque (`pct exec 213 -- journalctl -u forgejo --since "-15 min" --no-pager`) — prova: as linhas ou "nenhuma"
- [ ] 🤖 Os repositórios respondem: a API lista-os e os commits de um (ferramentas forgejo_*) — prova: o repositório e o último commit
- [ ] 🤖 Os mirrors continuam a sincronizar: um `starred/*` com o último sync depois da instalação, ou sem erro — prova: o repositório e a hora (ou "não se consegue ver")
- [ ] 🤖 Correu um backup novo pelo MyHomeLab, sem nada "de fora" — prova: a hora, o tamanho e o resultado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Onde ver:** a saída do comando que falhou e `journalctl -u forgejo -n 50`.
- **Contorna-se:** um binário descarregado com outro nome, um timeout curto, ou falta de espaço que se liberta com caches.

### Nunca

- Instalar sem o backup da última hora ou sem o snapshot.
- Apagar repositórios, utilizadores, a base de dados ou outra pasta que não seja a cache `repo-archive`.
- Mexer no `app.ini` durante a atualização.
- Voltar a um binário antigo depois de a base de dados migrar (só com o snapshot).
- Mostrar palavras-passe, tokens ou chaves.
