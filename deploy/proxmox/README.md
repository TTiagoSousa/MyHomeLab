# Instalar no Proxmox (LXC)

Um script no host do Proxmox cria um container Debian 13 e instala lá dentro tudo o que
a app precisa. Sem Docker e sem Coolify.

```
┌─────────────────────── CT (Debian 13, unprivileged) ───────────────────────┐
│                                                                             │
│   nginx :80 ──┬── /        → /var/www/myhomelab   (frontend, ficheiros)     │
│               └── /api/*   → 127.0.0.1:3000       (backend, systemd)        │
│                                    │                                        │
│                               PostgreSQL 17 (só localhost)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Peça | Onde |
|---|---|
| Código | `/opt/myhomelab` (clone do repo, utilizador `myhomelab`) |
| Configuração | `/etc/myhomelab/myhomelab.env` |
| Serviço | `myhomelab.service` (`node dist/src/main.js`) |
| Frontend publicado | `/var/www/myhomelab` |
| Base de dados | PostgreSQL local, base e utilizador `myhomelab` |
| Backups | `/var/backups/myhomelab`, todos os dias às 03:30 e antes de cada atualização (`…-before-update.sql.gz`), 14 dias |
| Credenciais geradas | `/root/myhomelab-credentials.txt` |

## 1. Criar e instalar

Na **Shell do host** do Proxmox (Datacenter → nó → Shell), uma linha:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/MyHomeLab/main/deploy/proxmox/ct-create.sh)"
```

Abre um menu (em inglês, ao estilo dos community-scripts):

- **Default settings** — próximo CT livre, primeiro storage ativo, 16 GB, 2 CPUs,
  2 GB de RAM, DHCP, DNS do host, endereço `http://<IP do CT>`, branch `main`.
- **Advanced settings** — ecrã a ecrã, já preenchido com a sugestão:
  - ID e hostname (valida se o ID está livre);
  - storage do disco e dos templates, escolhidos de uma lista com o espaço livre;
  - disco, CPUs, RAM, swap;
  - bridge (lista), **DHCP ou IP estático** (IP/prefixo + gateway), VLAN opcional;
  - DNS do host ou servidores próprios;
  - arrancar com o host;
  - endereço da app: IP do container ou domínio próprio;
  - utilizador e password do admin (em branco = `admin`);
  - versão: `main`, `staging` ou `develop`; token só se o repo for privado.

Um valor inválido volta a ser pedido em vez de abortar. No fim aparece o ecrã **Review**
com tudo o que foi escolhido: *Create the container*, *Edit settings* ou *Cancel*.


**Utilizador inicial: `admin` / `admin`.** Troca a password antes de abrires a app à
internet.

Sem menus (automação): `NONINTERACTIVE=1` e as variáveis que quiseres mudar — lista
no cabeçalho do `ct-create.sh`:

```bash
NONINTERACTIVE=1 STORAGE=zfs_pool NET_MODE=static IP=192.168.1.60/24 GATEWAY=192.168.1.1 APP_URL=https://myhomelab.example.com bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/MyHomeLab/main/deploy/proxmox/ct-create.sh)"
```

## 2. Domínio e SSL

No Nginx Proxy Manager: `myhomelab.example.com` → `http://<IP do CT>:80`, com SSL.
Liga **Websockets Support** (o estado ao vivo dos agentes usa uma ligação longa).

O `APP_URL` tem de ser o endereço por onde abres a app: é o destino do regresso do OAuth
da Google e decide se o cookie de sessão é `secure` (só com `https`). Se o mudares
depois, ajusta `FRONTEND_URL` e `GOOGLE_OAUTH_REDIRECT_URI` com o `myhomelab-config`.

## 3. Configurar integrações

Dentro do CT (`pct enter <CTID>`):

```bash
myhomelab-config
```

Abre um menu com as definições e o valor atual de cada uma (segredos mascarados):
↑/↓ escolhe, Enter abre a caixa para alterar, **Save** grava e pergunta se reinicia o
backend para aplicar. As alteradas ficam marcadas com `*`; **Quit** sai sem gravar.
A base de dados, o `JWT_SECRET` e o `TOKEN_ENCRYPTION_KEY` não aparecem no menu.
`myhomelab-config --raw` abre o ficheiro inteiro no nano.

O que normalmente falta preencher:

| Variável | Para quê |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail e Google Tasks |

A chave do assistente (Claude) e os servidores Proxmox não vão aqui: cada utilizador
põe os seus na app, em **Definições → IA** e **Definições → Servidores**. Quem já tinha
`PROXMOX_*` no ficheiro de configuração não perde nada — no primeiro arranque esses
valores passam a um servidor "Proxmox" do primeiro admin.

Na consola da Google regista o redirect URI
`<APP_URL>/api/connected-account/google/callback`.

> ⚠ **`TOKEN_ENCRYPTION_KEY` não se muda.** Cifra os tokens das contas ligadas; com
> outra chave nenhuma conta volta a abrir. O `myhomelab-config` recusa gravar uma
> alteração a essa linha.

## Depois de instalar

**A IA (Claude Code, com a subscrição).** O instalador já instala o `claude`. Falta a sessão,
uma de duas:

```bash
# no CT, como o utilizador do serviço (abre um link para aprovar no browser)
runuser -u myhomelab -- env HOME=/var/lib/myhomelab claude auth login
```

ou, num PC com browser, `claude setup-token` e cola o token na app em Definições → IA.
Depois, em Definições → IA, **Verificar** tem de mostrar "Ligado".

Entra na app e abre a página **Ajuda** (no menu): tem os guias passo a passo para cada
integração — chave do Claude, Google (Gmail e Tasks, incluindo a configuração na Google
Cloud), Telegram, servidores Proxmox, serviços vigiados, AdGuard Home, Home Assistant e Nextcloud.

## 4. Atualizar

**Pela app (admin):** página **Admin** → card **Versão** → *Atualizar para vX.Y.Z*, ou
*Ver versões* para a lista com as notas de cada release e escolher qualquer versão mais
recente. Saltar versões é seguro (as migrações aplicam-se todas); voltar para trás não é
permitido. A janela mostra o progresso e recarrega a página no fim.

> **Atenção: a atualização para a v2.0.0 (ou por cima dela) apaga os dados.** A migração
> `fresh_start` esvazia todas as tabelas menos os utilizadores, as chaves de IA e os tipos de
> exercício. O Jarvis (CEO) e o projeto das atualizações voltam a ser criados no primeiro uso
> (a restante equipa monta-se no Workflow); apps ligadas, servidores, Gmail, regras, backups e saúde
> ficam por pôr outra vez. Se precisares do que havia, está no dump
> `/var/backups/myhomelab/myhomelab-<data>-before-update.sql.gz` dessa atualização (14 dias) —
> guarda uma cópia antes de atualizar.

**Pela consola (dentro do CT):**

```bash
myhomelab-update             # a última release (tag vX.Y.Z)
myhomelab-update v1.4.0      # uma release específica
myhomelab-update develop     # um branch (testes)
FORCE=1 myhomelab-update     # recompilar mesmo sem nada novo
```

Faz fetch, checkout da versão, `npm ci`, build, **guarda a base de dados**, migrações,
publica o frontend, reescreve as units e o nginx e reinicia o backend. Antes das migrações,
`dump_db` grava `/var/backups/myhomelab/myhomelab-<data>-before-update.sql.gz`
(`pg_dump --clean`, permissões 600; apagado com os do cron ao fim de 14 dias). **Se um passo
falhar, volta sozinho à versão anterior** e a app continua a funcionar: se as migrações já
tinham começado, primeiro `restore_db` repõe a base (para o serviço, `dropdb --force`,
`createdb -O myhomelab` e carrega o dump); depois checkout do código anterior, build e
restart.

Como o botão funciona: o backend corre sem privilégios e só escreve
`/var/lib/myhomelab/updates/request` com a versão; a unit `myhomelab-updater.path`
(root) vê o ficheiro e corre `update.sh --from-request`, que escreve o progresso em
`status.json` e o output em `update.log` na mesma pasta. Logs: `journalctl -u myhomelab-updater`.

## Releases

Uma release é uma tag `vX.Y.Z` anotada no `main`. As notas ficam em
`releases/<versão>/{en,pt-PT,es}.md` e a app mostra as da língua escolhida (inglês como
recurso, depois a mensagem da tag). Para lançar, no `main` atualizado:

```bash
npm run release -- --dry-run   # vê a versão e as notas
npm run release -- --prepare   # escreve releases/<versão>/en.md a partir dos commits
# escrever pt-PT.md e es.md ao lado, commit no main
npm run release -- --push      # cria a tag (mensagem = en.md) e envia-a
```

A versão sobe pelos commits desde a última release: `feat` → minor, `fix`/`perf`/
`refactor` → patch, `!` ou `BREAKING CHANGE` → major. As notas agrupam-se em
*Features*, *Fixes* e *Improvements* (os `chore`/`docs`/`ci` ficam de fora).
`--title "…"` põe uma frase por cima das notas; `--notes ficheiro.md` usa notas escritas
à mão.

## 5. Manutenção

```bash
journalctl -u myhomelab -f          # logs do backend
systemctl status myhomelab nginx postgresql
/opt/myhomelab/deploy/proxmox/backup.sh            # backup agora
gunzip -c /var/backups/myhomelab/<ficheiro>.sql.gz | runuser -u postgres -- psql -d myhomelab   # repor
```

O backup do Proxmox (vzdump) apanha o container inteiro, mas um snapshot com o Postgres
a correr nem sempre é consistente — o dump diário é o que garante a base de dados.

### Backup completo do MyHomeLab

Em **Admin → Backup** define-se a password dos backups e cria-se um backup completo
(`myhomelab-<data>.mhlbackup`, cifrado): a base de dados inteira e as chaves que leem os logins
guardados. Descarrega-se, ou agenda-se para o Nextcloud ou para uma pasta do próprio CT
(destino "Neste servidor"). Repõe-se pela app (Admin → Backup → Repor um backup) ou aqui:

```bash
myhomelab-restore /root/myhomelab-2026-11-17_030000.mhlbackup   # pede a password e RESTORE
```

Para passar para um CT novo: instala-o (`ct-create.sh`) e corre o `myhomelab-restore` com o
backup. Antes de repor guarda-se um dump da base de dados atual; se algo falhar, volta a ele.

## Utilizadores

O instalador cria o primeiro utilizador (ADMIN, por omissão `admin`/`admin`). A partir daí o registo público está
fechado: as contas novas criam-se no painel de Admin da app.

## Reinstalar por cima

`bash /opt/myhomelab/deploy/proxmox/install.sh` dentro do CT pode correr outra vez: a
configuração, os segredos e a base de dados que já existem ficam como estão.
