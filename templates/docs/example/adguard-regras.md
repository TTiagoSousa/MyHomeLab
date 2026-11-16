---
title: AdGuard – regras
kind: RULES
tags: [adguard, estudo, instalacao]
apps: [ADGUARD]
---
# AdGuard – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar AdGuard X → Y" em Study (o pedido de estudo do MyHomeLab).
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" (o caminho e o que decides sozinho). **Depois:** "AdGuard – instalar uma atualização". **No dia a dia:** "AdGuard – como se mexe no DNS".

No estudo só se lê e mede. Nada se instala, reinicia ou apaga.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** CT 100 `adguard` (192.168.1.206), servidor HomeLab, 1 núcleo, 512 MB, disco 4 GB (zfs_pool). Comandos: `pct exec 100 -- <comando>`. Endereço: https://adguard.example.com.
- **Instalação:** binário em `/opt/AdGuardHome/AdGuardHome` (instalado por community-script), serviço systemd `AdGuardHome`, configuração `/opt/AdGuardHome/AdGuardHome.yaml` (`schema_version: 34` a 13/11/2026), dados (estatísticas, registo de pedidos, listas descarregadas) em `/opt/AdGuardHome/data`. O atualizador do próprio AdGuard guarda a versão anterior em `/opt/AdGuardHome/agh-backup`. Uso normal: ~110 MB de memória.
- **O papel:** é **o DNS da rede inteira e do próprio CT 100** (nameserver 192.168.1.206). Se parar, a casa fica sem internet (nada resolve nomes) e o CT também não descarrega nada. Por isso **descarrega-se tudo antes de parar**, e a paragem dura só segundos.
- **Versão e releases:** o MyHomeLab lê a versão na API (`/control/status`); as releases e o CHANGELOG estão em https://github.com/AdguardTeam/AdGuardHome/releases.
- **Backup do MyHomeLab:** um JSON com as definições que a API mostra (DNS, listas, reescritas, clientes, acessos, serviços bloqueados, proteções, registos e estatísticas, DHCP). Ficam de fora os certificados TLS, a password do painel, as estatísticas e o histórico de pedidos.
- **A configuração:** o `AdGuardHome.yaml` tem um `schema_version`. Uma versão nova pode migrá-lo ao arrancar, e a migração não se desfaz: voltar atrás é pelo snapshot.

### O que ler

1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes), não só a última. Atenção a "breaking", "deprecated", "removed", "migration", "schema", "configuration", "upstream", "DNS-over-HTTPS", "DNSSEC", "DHCP", "TLS", "API", "security".
2. As issues abertas da versão nova (update_known_issues), sobretudo as de DNS que deixa de responder, consumo de memória ou CPU, perda de definições na migração e a API.
3. Se as notas mudam a API `/control` (o MyHomeLab e as ferramentas `adguard_*` usam-na): o que muda.
4. As chaves do `AdGuardHome.yaml` que as notas dizem que mudam: `pct exec <CT> -- grep -n "<CHAVE>" <pasta>/AdGuardHome.yaml`. Nunca o ficheiro inteiro: tem a password do painel (o hash) e pode ter certificados.

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · AdGuard", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Onde corre e como está instalado:** continua como em "A app" (`pct exec 100 -- systemctl is-active AdGuardHome`, `ls /opt/AdGuardHome`, o `schema_version`) — prova: o que se viu. Se mudou, propõe uma versão nova deste documento (docs_propose)
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige, em linguagem simples — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Segurança:** as falhas de segurança que corrige (as do AdGuard e as do Go que ele traz), com os links — prova: a lista (ou "nenhuma")
- [ ] 🤖 **Sem issues graves abertas** na versão nova (DNS que pára ou fica lento, memória a crescer, definições perdidas na migração, DHCP, a API) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Sem passos à mão:** nenhuma chave do `AdGuardHome.yaml` nem do compose que tenha de mudar à mão; se a configuração migra (`schema_version`), diz-se — prova: as notas e as chaves vistas (ou os passos)
- [ ] 🤖 **A ligação do MyHomeLab continua:** nada nas notas muda o login do painel nem as rotas da API que se usam (`/control/status`, `/filtering/*`, `/rewrite/*`, `/querylog`, `/stats`) — prova: as notas (ou o que muda)
- [ ] 🤖 **Há um plano B para o DNS:** os aparelhos têm um DNS secundário (o router ou outro servidor) ou não; sem ele, a instalação deixa a casa sem internet uns segundos, o que se diz no relatório — prova: o que se sabe (ou "por confirmar por mim")
- [ ] 🤖 **O backup do AdGuard está ativo** (list_backups): ligado, com destino e sem erro — prova: o backup, o destino e o estado
- [ ] 🤖 **Salto de versão major** (ex.: 0.107 → 0.108 ou → 1.0): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Pode partir:** uma migração da configuração (`schema_version`) sem volta, ou uma rota da API que o MyHomeLab usa que muda.
- **Pergunta-se:** só se não se perceber como está instalado, ou se uma chave do `AdGuardHome.yaml` tiver de mudar e isso mudar o que é bloqueado.
- **Lembra:** a instalação deixa o DNS (e os monitores que dependem dele) em baixo uns segundos. Isso não é razão para esperar: diz-se no resumo.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: se a configuração migra, se a ligação do MyHomeLab continua, se há DNS secundário e quanto tempo o DNS fica em baixo.

### Nunca

- Atualizar, reiniciar ou parar o AdGuard durante o estudo.
- Ler o `AdGuardHome.yaml` inteiro, ou mostrar a password, os certificados ou tokens.

## Instalar uma atualização

> **Quando usar:** uma atualização do AdGuard em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu. Instala-se logo, a qualquer hora.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("AdGuard – estudar uma atualização").

Estar em Ready to update é a aprovação: não se pede outro sim, nem num salto major.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. O que se resolve dentro destas regras resolve-se e volta a medir-se. Se um ponto falhar e não se resolver, não se instala: Waiting for reply com o que falhou e as opções.

**O AdGuard é o DNS da casa:** a instalação tem de ser curta. Enquanto ele reinicia, nada resolve nomes.

### Onde corre

- **Onde:** CT 100 `adguard` (192.168.1.206), servidor HomeLab, 1 núcleo, 512 MB, disco 4 GB (zfs_pool). Comandos: `pct exec 100 -- <comando>`. Endereço: https://adguard.example.com.
- **Instalação:** binário em `/opt/AdGuardHome/AdGuardHome` (instalado por community-script), serviço systemd `AdGuardHome`, configuração `/opt/AdGuardHome/AdGuardHome.yaml` (`schema_version: 34` a 13/11/2026), dados (estatísticas, registo de pedidos, listas descarregadas) em `/opt/AdGuardHome/data`. O atualizador do próprio AdGuard guarda a versão anterior em `/opt/AdGuardHome/agh-backup`. Uso normal: ~110 MB de memória.
- **O papel:** é **o DNS da rede inteira e do próprio CT 100** (nameserver 192.168.1.206). Se parar, a casa fica sem internet (nada resolve nomes) e o CT também não descarrega nada. Por isso **descarrega-se tudo antes de parar**, e a paragem dura só segundos.
- **Versão e releases:** o MyHomeLab lê a versão na API (`/control/status`); as releases e o CHANGELOG estão em https://github.com/AdguardTeam/AdGuardHome/releases.
- **Backup do MyHomeLab:** um JSON com as definições que a API mostra (DNS, listas, reescritas, clientes, acessos, serviços bloqueados, proteções, registos e estatísticas, DHCP). Ficam de fora os certificados TLS, a password do painel, as estatísticas e o histórico de pedidos.
- **A configuração:** o `AdGuardHome.yaml` tem um `schema_version`. Uma versão nova pode migrá-lo ao arrancar, e a migração não se desfaz: voltar atrás é pelo snapshot.

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 A instalação é a deste documento: `pct exec 100 -- systemctl is-active AdGuardHome` diz active e o binário está em `/opt/AdGuardHome` — prova: o que se viu
- [ ] 🤖 O backup do AdGuard está ativo: ligado, com destino e sem erro (list_backups). Se não estiver, não se configura: pergunta-se — prova: o backup, o destino e o estado
- [ ] 🤖 Há um backup do AdGuard feito pelo MyHomeLab **há menos de 1 hora**, sem erro e **sem nada "de fora"** inesperado; se não, corre-o (run_backup) e espera que acabe — prova: a hora, o ficheiro e o tamanho
- [ ] 🤖 Antes, para comparar depois: adguard_overview e adguard_get_settings rewrites (quantas listas e regras, as reescritas, os clientes) — prova: os números
- [ ] 🤖 O disco do CT 100 está abaixo de 85% (`pct exec 100 -- df -h /`; o arquivo e o binário novo ocupam ~70 MB) e a memória não está cheia — prova: as percentagens
- [ ] 🤖 O AdGuard responde na versão de partida e o DNS resolve (`pct exec 100 -- nslookup google.com 127.0.0.1`) — prova: a versão e a resposta
- [ ] 🤖 Não há outra atualização a correr no mesmo servidor — prova: o que está a correr
- [ ] 🤖 Salto de versão major: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### Instalar

> O `checksums.txt` do AdGuard escreve os nomes com `./` à frente (ex.: `<hash>  ./AdGuardHome_linux_amd64.tar.gz`): o grep aceita os dois.

O update_run tira o snapshot do CT 100, corre os comandos por ordem (pára no primeiro que falhar) e espera até 5 minutos que o AdGuard responda na versão nova. Se falhar, volta sozinho ao snapshot.

Os comandos, por esta ordem (`<v>` é a versão nova, sem o "v"). Primeiro descarrega-se e verifica-se, com o DNS ainda a funcionar; só depois se para:

```bash
pct exec 100 -- bash -lc 'cd /tmp && wget -q -O AdGuardHome_linux_amd64.tar.gz https://github.com/AdguardTeam/AdGuardHome/releases/download/v<v>/AdGuardHome_linux_amd64.tar.gz && wget -q -O agh-checksums.txt https://github.com/AdguardTeam/AdGuardHome/releases/download/v<v>/checksums.txt'
pct exec 100 -- bash -lc 'cd /tmp && grep -E " (\./)?AdGuardHome_linux_amd64\.tar\.gz$" agh-checksums.txt | sha256sum -c - && tar -xzf AdGuardHome_linux_amd64.tar.gz -C /tmp && /tmp/AdGuardHome/AdGuardHome --version'
pct exec 100 -- cp -a /opt/AdGuardHome/AdGuardHome.yaml /opt/AdGuardHome/AdGuardHome.yaml.pre-<v>
pct exec 100 -- systemctl stop AdGuardHome
pct exec 100 -- install -m 0755 -o root -g root /tmp/AdGuardHome/AdGuardHome /opt/AdGuardHome/AdGuardHome
pct exec 100 -- systemctl start AdGuardHome
pct exec 100 -- rm -rf /tmp/AdGuardHome /tmp/AdGuardHome_linux_amd64.tar.gz /tmp/agh-checksums.txt
```

A rede fica sem DNS só entre o `stop` e o `start` (segundos). A cópia `AdGuardHome.yaml.pre-<v>` é a configuração de antes da migração (o `schema_version` não volta atrás sozinho).

### Depois de instalar
- [ ] 🤖 O AdGuard responde na versão nova (`/control/status`, adguard_overview) e a proteção está como estava — prova: a versão e o estado
- [ ] 🤖 O DNS resolve: `pct exec 100 -- nslookup google.com 127.0.0.1` e um domínio da casa que tenha reescrita — prova: as respostas
- [ ] 🤖 Um domínio de publicidade conhecido continua bloqueado (adguard_check_domain, ex.: doubleclick.net) — prova: o resultado
- [ ] 🤖 As listas, as regras próprias, as reescritas e os clientes são os mesmos de antes — prova: os números antes e depois
- [ ] 🤖 O registo de pedidos recebe pedidos novos (adguard_query_log dos últimos minutos) — prova: as linhas
- [ ] 🤖 Sem erros novos no log desde o arranque (`pct exec 100 -- journalctl -u AdGuardHome --since "-15 min" --no-pager`) — prova: as linhas ou "nenhuma"
- [ ] 🤖 A memória do serviço está normal (abaixo de ~300 MB; `systemctl status AdGuardHome`) — prova: a memória
- [ ] 🤖 Correu um backup novo pelo MyHomeLab, sem erro — prova: a hora, o tamanho e o resultado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **O DNS não resolve:** é urgente (a casa fica sem internet). Se o MyHomeLab não voltou sozinho ao snapshot, diz-se logo, em primeiro lugar.
- **Onde ver:** a saída do comando que falhou e `pct exec 100 -- journalctl -u AdGuardHome -n 50`.
- **Contorna-se:** um checksum ou um nome de ficheiro com outro formato (corrige-se o comando, nunca se salta a verificação), ou um ficheiro em `/tmp` de uma tentativa anterior.

### Nunca

- Instalar sem o backup da última hora, sem o snapshot do CT 100 ou sem a cópia do `AdGuardHome.yaml`.
- Parar o AdGuard antes de o binário novo estar descarregado e verificado.
- Mexer no `AdGuardHome.yaml` à mão durante a atualização.
- Apagar `/opt/AdGuardHome/data` ou `agh-backup`.
- Mostrar a password do painel, certificados ou tokens.
