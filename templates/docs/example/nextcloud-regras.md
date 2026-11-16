---
title: Nextcloud – regras
kind: RULES
tags: [nextcloud, estudo, pecas, instalacao]
apps: [NEXTCLOUD]
---
# Nextcloud – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar Nextcloud X → Y" (o servidor) ou "Atualizar Nextcloud · <app> X → Y" (uma app lá dentro: Calendar, Contacts, Mail, Tables, Assistant…) em Study.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam". **Depois:** "Nextcloud – instalar uma atualização".

No estudo só se lê e mede. Os pontos **Só servidor** ou **Só apps** valem só para esse tipo; no outro marcam-se "não se aplica".

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** VM 101 `nextcloud-vm`, servidor HomeLab, https://nextcloud.example.com. Comandos pelo agente QEMU: `qm guest exec 101 --timeout <s> -- <comando>`.
- **occ como www-data:** a VM **não tem `sudo`**: `qm guest exec 101 --timeout 120 -- runuser -u www-data -- php /var/www/nextcloud/occ <comando>`.
- **Pastas:** código em `/var/www/nextcloud`, dados e log em `/var/www/nextcloud-data` (`nextcloud.log`). Base de dados MySQL/MariaDB, PHP 8.4.
- **Para que serve:** os meus ficheiros, Calendar e Contacts (CalDAV/CardDAV), Mail, e é o **destino dos backups** das outras apps.
- **Atenção:** o upgrade do servidor atualiza também as apps da App Store que tenham versão nova. Por isso, no estudo do servidor, as apps com versão nova estudam-se também.

### O que ler

**O servidor**
1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes). Atenção a "upgrade", "migration", "PHP", "breaking", "occ".
2. As issues abertas (update_known_issues) e os avisos em help.nextcloud.com.
3. nextcloud_list_apps: as apps que ficam sem versão para o Nextcloud novo e as que têm versão nova (essas vêm junto no upgrade).

**Uma app**
1. O changelog de todas as versões entre a instalada e a nova (update_release_notes, da App Store). Vazio → as releases no GitHub da app (`nextcloud/<app>` ou `nextcloud-releases/<app>`).
2. As issues abertas da versão nova (update_known_issues e o issue tracker da app).
3. A ficha na App Store: as versões do Nextcloud que a versão nova aceita.

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · Nextcloud", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige, em linguagem simples — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Sem issues graves abertas** (perda de ficheiros ou dados, upgrade que falha, login, sincronização, CalDAV/CardDAV; no Mail: envio e receção) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Sem passos à mão** (`config.php`, PHP, configuração da app; o `occ db:add-missing-indices` faz parte da instalação, não conta) — prova: as notas lidas (ou os passos)
- [ ] 🤖 **Só servidor · as apps aguentam:** nenhuma app ligada fica sem versão para o Nextcloud novo (o upgrade desliga-as) — prova: a lista (ou as que ficariam de fora)
- [ ] 🤖 **Só servidor · as apps que vêm junto:** as que têm versão nova na App Store, cada uma com a versão e se tem issues graves — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Só servidor · o PHP chega** para a versão nova — prova: a versão do PHP e o que pedem as notas
- [ ] 🤖 **Só apps · aceita o Nextcloud instalado** (a versão do servidor está no intervalo da App Store) — prova: a versão do servidor e o intervalo da app
- [ ] 🤖 **O backup do Nextcloud está ativo** (list_backups): ligado, com destino e sem erro — prova: o backup e o estado
- [ ] 🤖 **Salto de versão major** (servidor 35 → 36, ou app 5.x → 6.0): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Servidor:** pode partir uma app ligada que fica sem versão (o upgrade desliga-a), o PHP que não chega, ou uma app que vem junto e tem issues graves.
- **Apps:** pode partir se não aceitar o Nextcloud instalado (`later` até o servidor subir).
- **Pergunta-se:** uma app que ficaria desligada, ou PHP a mudar.

Cada app tem a sua tarefa e a sua decisão. O servidor primeiro, as apps depois.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: se aceita o Nextcloud instalado (apps), ou que apps ficam de fora e quais vêm junto (servidor, numa secção "## Apps instaladas").

### Nunca

- Atualizar, ligar a manutenção, ou ligar, desligar ou instalar apps durante o estudo. Pode-se: `occ status`, `occ app:list`, `occ app:update --showonly`, `occ db:schema:check`, `/status.php`, nextcloud_overview, nextcloud_list_apps.
- Usar `sudo` (não existe na VM) ou correr o `occ` como root.
- Mostrar o conteúdo do `config.php`, palavras-passe ou tokens.

## Instalar uma atualização

> **Quando usar:** uma atualização do Nextcloud (o servidor ou uma app lá dentro) em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu. Instala-se logo, a qualquer hora.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("Nextcloud – estudar uma atualização").

Estar em Ready to update é a aprovação: não se pede outro sim, nem num salto major. Os pontos **Só servidor** ou **Só apps** valem só para esse tipo; no outro marcam-se "não se aplica".

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. Se um falhar e não se resolver dentro destas regras, não se instala: Waiting for reply com o que falhou e as opções.

### Onde corre

- **Máquina:** VM 101 `nextcloud-vm`, servidor HomeLab (https://nextcloud.example.com). Comandos pelo agente QEMU: `qm guest exec 101 --timeout <segundos> -- <comando>`.
- **occ como www-data:** a VM **não tem `sudo`**; o agente QEMU corre como root, por isso: `runuser -u www-data -- php /var/www/nextcloud/occ …`.
- **O tempo:** o `qm guest exec` desiste aos 30 s se não se disser outro. Sempre `--timeout`: 300 numa app, 1200 no servidor.
- **Pastas:** código em `/var/www/nextcloud`, updater em `/var/www/nextcloud/updater/updater.phar`, dados e log em `/var/www/nextcloud-data`.
- **Destino dos backups** das outras apps: se o Nextcloud cai, os backups deixam de ter onde ir.

### Como corre a instalação

1. **update_prepare** com os comandos de "Instalar o servidor" ou de "Instalar uma app", tal e qual, e os pontos de "Antes de instalar" provados.
2. **update_run** (com snapshot) tira o snapshot da VM 101, corre os comandos um a seguir ao outro (pára no primeiro que falhar) e espera até 5 minutos que o Nextcloud responda na versão nova.
3. **Se falhar**, o MyHomeLab volta sozinho ao snapshot, liga a VM e fica em Failed. Depois disso, voltar a um snapshot à mão é com o meu sim.
4. A VM leva 1 a 2 minutos a arrancar depois de um rollback: um 502 logo a seguir não quer dizer que ficou estragada.

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 Não há outra atualização do Nextcloud (servidor ou app) a correr — prova: o que está a correr
- [ ] 🤖 Há um backup do Nextcloud feito pelo MyHomeLab **há menos de 24 horas** e sem erro; se não, corre-o (run_backup) e espera que acabe bem — prova: a hora e o ficheiro
- [ ] 🤖 O Nextcloud responde, sem manutenção (`/status.php`), e está na versão de partida (o servidor no status, a app em nextcloud_list_apps). **Só apps:** se a app já estiver na versão nova (veio com o servidor), não há nada a instalar: passa-se à verificação — prova: o JSON e a versão
- [ ] 🤖 O `occ` corre como www-data: `qm guest exec 101 --timeout 60 -- runuser -u www-data -- php /var/www/nextcloud/occ status` dá código 0 e mostra a versão — prova: a saída
- [ ] 🤖 **Só apps:** a versão que vai entrar é a estudada. O `occ app:update` instala sempre a mais recente: `qm guest exec 101 --timeout 120 -- runuser -u www-data -- php /var/www/nextcloud/occ app:update --showonly`. Se for uma versão de correção mais nova da mesma linha, instala-se na mesma; se for outra linha ou major, pergunta-se — prova: a linha da app
- [ ] 🤖 **Só servidor:** as apps que vêm junto (`occ app:update --showonly`) são as do estudo e nenhuma é major nem tem issues graves; se for, pergunta-se — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Só servidor:** o esquema da base de dados medido antes (`qm guest exec 101 --timeout 120 -- runuser -u www-data -- php /var/www/nextcloud/occ db:schema:check`). Não trava nada: serve para comparar depois — prova: a saída (ou "sem avisos")
- [ ] 🤖 O disco onde está o Nextcloud tem menos de 90% ocupado e a memória não está cheia (`qm guest exec 101 -- df -h /var/www/nextcloud-data` e `qm guest exec 101 -- free -m`) — prova: as percentagens
- [ ] 🤖 Salto de versão major: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### Instalar o servidor

Os comandos, por esta ordem:

```bash
qm guest exec 101 --timeout 1200 -- runuser -u www-data -- php /var/www/nextcloud/updater/updater.phar --no-interaction
qm guest exec 101 --timeout 1200 -- runuser -u www-data -- php /var/www/nextcloud/occ upgrade
qm guest exec 101 --timeout 120 -- runuser -u www-data -- php /var/www/nextcloud/occ maintenance:mode --off
qm guest exec 101 --timeout 600 -- runuser -u www-data -- php /var/www/nextcloud/occ db:add-missing-indices
```

O updater descarrega, liga a manutenção, troca os ficheiros, corre o upgrade e desliga a manutenção; os outros três não fazem mal se já não houver nada a fazer. Depois do upgrade, a base de dados não volta atrás sem o snapshot.

### Instalar uma app

Um só comando, só a app da tarefa:

```bash
qm guest exec 101 --timeout 300 -- runuser -u www-data -- php /var/www/nextcloud/occ app:update <app>
```

O `<app>` é o id (`calendar`, `contacts`, `mail`, `tables`, `assistant`…). A saída tem de dizer que a app foi atualizada. Sem manutenção.

### Depois de instalar
- [ ] 🤖 Cada comando acabou com código 0 (o `exitcode` na saída do `qm guest exec`, no registo) — prova: os códigos
- [ ] 🤖 `/status.php` responde com `maintenance:false` e `needsDbUpgrade:false` (no servidor, já na versão nova) — prova: o JSON
- [ ] 🤖 As apps estão ligadas, e a atualizada na versão nova (nextcloud_list_apps) — prova: as versões (ou as que ficaram desligadas)
- [ ] 🤖 Sem erros novos no log desde a atualização: `qm guest exec 101 -- tail -n 50 /var/www/nextcloud-data/nextcloud.log`, só os de nível 3 e 4 — prova: as linhas ou "nenhuma"
- [ ] 🤖 O que se vê de fora funciona: a página de login responde 200; Calendar e Contacts leem-se por CalDAV/CardDAV (o backup do MyHomeLab lê-os). Abrir a interface (ex.: o Mail) não se consegue ver: "não se aplica" — prova: os códigos e o backup
- [ ] 🤖 **Só servidor:** o `occ db:schema:check` não tem avisos novos em relação ao de antes — prova: as diferenças (ou "igual")
- [ ] 🤖 **Só servidor:** correu um backup novo pelo MyHomeLab — prova: a hora e o resultado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Onde ver:** a saída do comando que falhou e `qm guest exec 101 -- tail -n 50 /var/www/nextcloud-data/nextcloud.log`.
- **Ficou em manutenção** depois de um upgrade que acabou bem (o status já diz a versão nova): pode desligar-se com `occ maintenance:mode --off`. Se o upgrade não acabou, não se desliga: fica o snapshot.
- **Contorna-se:** um timeout do `qm guest exec` (sobe o `--timeout`), ou os índices em falta (`occ db:add-missing-indices`).
- **Uma app desligada pelo upgrade** não se liga à sorte: diz-se no relatório.

### Nunca

- Atualizar o servidor e uma app no mesmo passo, ou `occ app:update --all`.
- Instalar, desligar ou remover apps que não são as da tarefa.
- Mexer no `config.php`, nos utilizadores, nas partilhas ou nos ficheiros dos utilizadores.
- Desligar o Nextcloud ou a VM 101 fora de uma atualização.
- Usar `sudo` (não existe na VM) ou correr o `occ` como root.
- Mostrar palavras-passe, tokens, a password de app do MyHomeLab ou o conteúdo do `config.php`.
