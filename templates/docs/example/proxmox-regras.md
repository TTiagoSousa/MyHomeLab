---
title: Proxmox – regras
kind: RULES
tags: [proxmox, atualizacao, estudo, instalacao]
server: true
---
# Proxmox – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa "Atualizar Proxmox VE · <servidor> X → Y" em Study: uma versão nova do Proxmox VE ou, sem ela, os pacotes do sistema (Debian) por atualizar no host.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam". **Depois:** "Instalar uma atualização", mais abaixo.
> **Não serve para:** as máquinas (CT e VM) nem as apps lá dentro.

No estudo só se lê e mede. **No host não há snapshot:** se algo correr mal não há volta atrás automática, por isso o estudo é cuidadoso e diz sempre se pede reinício.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### O servidor

- **HomeLab:** o host Proxmox (nó `proxmox`), comandos por SSH no host. Sem subscrição: repositórios **no-subscription**, sem Ceph.
- Como está montado (discos, máquinas, arranque automático): o "Guia do servidor HomeLab" (docs_search).

### O que ler

1. O que muda: a versão do Proxmox VE (de → para), os pacotes por atualizar (update_release_notes) e se há kernel novo (`proxmox-kernel-*`).
2. **Versão nova do Proxmox VE:** o changelog do pve-manager, o roadmap e os problemas conhecidos no fórum do Proxmox (update_known_issues).
3. **Só pacotes do sistema:** a lista (de → para), os de segurança (origem `Debian-Security`) e os que pedem reinício (kernel, `libc6`, `systemd`, `shim`).
4. O simulate: `apt-get update` e `apt-get full-upgrade --simulate` (só leem).

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app (docs_search "Estudo da atualização · Proxmox", depois docs_read), comparados com agora: a máquina, a pasta, a instalação e os comandos continuam como lá diz; o que ficou "por confirmar no próximo estudo" resolveu-se; um problema de uma instalação anterior verifica-se agora — prova: os registos lidos e o que mudou desde então (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **O que muda**, em linguagem simples — prova: a versão de → para e o número de pacotes
- [ ] 🤖 **Sem problemas conhecidos** que toquem este servidor — prova: os links vistos ou "nenhum"
- [ ] 🤖 **Diz se pede reinício** (kernel novo, `libc6`, `shim`) — prova: os pacotes que o pedem (ou "não pede")
- [ ] 🤖 **O apt não quer remover nada** (`apt-get full-upgrade --simulate` sem linhas "Remv") — prova: o resumo do simulate
- [ ] 🤖 **Muda de versão principal** (ex.: 9 → 10): diz-se no resumo e na recomendação, com o que muda. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Instala-se sozinho** só com risco baixo (o MyHomeLab obriga): pacotes de correção e de segurança, nada a remover, sem reinício.
- **Fica para mim** (`recommend`, a dizer porquê): kernel novo ou outro reinício, versão principal nova, ou risco médio ou alto.
- **Pergunta-se:** pacotes a remover.

Sem passos à mão (manualSteps vazio): o reinício, se for preciso, fica escrito no estudo.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: se pede reinício e quanto tempo deve demorar.

### Nunca

- Correr `apt upgrade`, `apt full-upgrade` sem `--simulate`, ou mudar alguma coisa durante o estudo.
- Mostrar palavras-passe, tokens ou chaves.

## Instalar uma atualização

> **Quando usar:** uma atualização do host Proxmox em Ready to update (eu pus lá, ou o estudo com install, que no host só vale com risco baixo) ou um pedido direto meu. Instala-se logo, a qualquer hora, **sem reiniciar**.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("Estudar uma atualização", mais acima).

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. Se um falhar, não se instala: Waiting for reply com o que falhou e as opções. **No host não há snapshot:** o backup da configuração é obrigatório e nada se remenda sozinho.

### Onde corre

- **Servidor:** HomeLab, o host Proxmox (comandos por SSH no host).
- **Arranque:** UEFI, sem proxmox-boot-tool. A partição EFI é a `sdb2` (vfat, 1 GiB) e deve estar montada em `/boot/efi`. Se não estiver, o GRUB e o shim novos não vão para a partição verdadeira e o host pode não arrancar no reinício seguinte.
- **Repositórios de sempre:** os **no-subscription** (o HomeLab não tem subscrição):
  - `/etc/apt/sources.list.d/pve-enterprise.sources` → desativado (`Enabled: no`);
  - `/etc/apt/sources.list.d/ceph.sources` → desativado (o HomeLab não usa Ceph);
  - `/etc/apt/sources.list.d/proxmox.sources` → `deb http://download.proxmox.com/debian/pve trixie pve-no-subscription` (Signed-By `/usr/share/keyrings/proxmox-archive-keyring.gpg`).

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install, risco baixo) — prova: o histórico
- [ ] 🤖 Não há backups, migrações nem outras tarefas a correr no Proxmox — prova: a lista de tarefas a correr vazia
- [ ] 🤖 Há pelo menos 5 GiB livres em `/` e em `/var/lib/vz` — prova: o `df -h` dos dois
- [ ] 🤖 Os repositórios são os de sempre (acima) — prova: o `cat` de `/etc/apt/sources.list` e de `/etc/apt/sources.list.d/`
- [ ] 🤖 Se a atualização traz GRUB, shim ou kernel: a partição EFI está montada em `/boot/efi` (`findmnt /boot/efi`). Se não estiver, já autorizei montá-la, depois do backup da configuração: confirmar com `efibootmgr -v` que o arranque é pela partição EFI do `sdb2`; tirar o UUID com `blkid /dev/sdb2`; acrescentar ao `/etc/fstab` a linha `UUID=<uuid> /boot/efi vfat umask=0077 0 1` (pelo UUID, nunca por `/dev/sdb2`); `mount /boot/efi`; e `findmnt /boot/efi` tem de a mostrar. Se o `efibootmgr` apontar para outro disco ou o `mount` falhar, não se instala: pergunta-se — prova: o `efibootmgr`, a linha do fstab e o `findmnt`, antes e depois
- [ ] 🤖 O apt não quer remover nada: `apt-get update` e `apt-get full-upgrade --simulate` sem linhas "Remv" — prova: o resumo (quantos atualiza, instala e remove)
- [ ] 🤖 O que se vai instalar é o que foi estudado: os mesmos pacotes, sem kernel ou versão do Proxmox VE a mais. Pacotes de correção a mais na mesma versão instalam-se; uma versão do Proxmox VE ou um kernel a mais não: volta a Espera por estudo — prova: o número de pacotes do estudo e o do simulate
- [ ] 🤖 O backup da configuração foi feito e está bom (abaixo) — prova: o nome, o tamanho e o `tar -tzf`
- [ ] 🤖 Muda de versão principal: se o é, já está aprovado (estar em Ready to update) — prova: "não é major", ou o histórico

### O backup da configuração

- **Onde:** `/var/lib/vz/backups-host/pve-config-<AAAA-MM-DD-HHMM>.tar.gz` (criar a pasta se não existir).
- **O quê:** `/etc/pve`, `/var/lib/pve-cluster/config.db`, `/etc/network`, `/etc/apt`, `/etc/hosts`, `/etc/hostname`, `/etc/fstab`, `/etc/default/grub`, `/etc/modprobe.d`.
- **Bom quando:** existe, tem mais de 0 bytes e o `tar -tzf` mostra as pastas acima.
- Ficam os 5 mais recentes. As máquinas não entram aqui (têm os backups delas, vzdump).

### Instalar

Os comandos, por esta ordem:

```bash
DEBIAN_FRONTEND=noninteractive apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confold full-upgrade
```

- **Nunca** `apt upgrade`, que no Proxmox pode deixar pacotes partidos.
- `--force-confold` mantém os ficheiros de configuração que mudámos: o apt não pergunta e não troca nada nosso.

**Se os repositórios enterprise ainda estiverem ativos** (dão 401), já autorizei esta troca, e só esta: primeiro o backup da configuração; depois mudar só os três ficheiros como em "Onde corre"; `apt-get update` sem 401; e propor a mudança no guia do servidor. Se o `apt-get update` continuar a falhar, parar e perguntar.

### Reiniciar

- Não se reinicia na instalação. Se o estudo disse que pede reinício, o aviso "Instalado" diz que falta reiniciar e porquê.
- Reiniciar é **sempre com o meu sim**, num pedido à parte. Antes, diz-me que máquinas têm arranque automático e quais não voltam sozinhas.

### Depois de instalar
- [ ] 🤖 A versão é a nova (ou, nos pacotes, a mesma de antes) — prova: o `pveversion`
- [ ] 🤖 Não ficou nada por atualizar nem partido — prova: `apt list --upgradable` vazio e `dpkg --audit` sem nada
- [ ] 🤖 A interface responde na porta 8006 — prova: a resposta do pedido
- [ ] 🤖 `pveproxy`, `pvedaemon`, `pve-cluster` e `pvestatd` estão ativos — prova: o `systemctl is-active` de cada um
- [ ] 🤖 As máquinas que estavam ligadas continuam ligadas — prova: a lista antes e depois
- [ ] 🤖 Diz se falta reiniciar (kernel novo instalado e ainda não em uso) — prova: o kernel em uso (`uname -r`) e o instalado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Parar logo e ver:** a saída do comando e o `dpkg --audit`. O backup da configuração está em `/var/lib/vz/backups-host/`.
- **Contorna-se:** um `dpkg` interrompido (`dpkg --configure -a`) ou um mirror em baixo (repetir o `apt-get update`). Nada que remova pacotes.
- O host não tem snapshot: se a causa não for clara à primeira, Waiting for reply.

### Nunca

- `apt upgrade`, `apt autoremove` ou remover pacotes.
- Mudar repositórios (fora da troca acima), `/etc/pve`, o `/etc/fstab` (fora da linha da partição EFI acima) ou a rede.
- Reiniciar o host sem o meu sim.
- Mexer nas máquinas (parar, arrancar, mudar recursos) durante a atualização.
- Mostrar palavras-passe, tokens ou chaves.
