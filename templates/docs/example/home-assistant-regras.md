---
title: Home Assistant – regras
kind: RULES
tags: [home assistant, estudo, pecas, instalacao]
apps: [HOME_ASSISTANT]
---
# Home Assistant – regras

## Estudar uma atualização

> **Quando usar:** uma tarefa do Home Assistant em Study. Há dois tipos:
> - **o Core** ("Atualizar Home Assistant X → Y"), que é a própria app;
> - **uma peça lá dentro** ("Atualizar Home Assistant · <nome> X → Y"): o Supervisor, o OS, um add-on, um repositório do HACS, o firmware de um dispositivo ou outra integração com atualização própria.
>
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam". **Depois:** "Home Assistant – instalar uma atualização".

No estudo só se lê e mede. Os pontos **Só Core** ou **Só peças** valem só para esse tipo; no outro marcam-se "não se aplica". Cada peça é uma atualização à parte, com a sua tarefa e a sua decisão, como as apps do Nextcloud.

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

### A app

- **Onde:** VM 102 `HomeAssistante`, servidor HomeLab (nó `proxmox`), https://homeassistant.example.com. 2 núcleos, 4096 MB, disco 32 GB em zfs_pool, UEFI (OVMF, q35), agente QEMU ligado, arranque automático (onboot, ordem 5). Instalada pelo community-script. **Tipo: Home Assistant OS** (tem atualizações do OS e do Supervisor e add-ons; a confirmar com ha_overview no próximo estudo).
- **Como se fala com ele:** pela API, com as ferramentas ha_* (ha_overview, ha_list_updates, ha_list_entities, ha_system_log, ha_list_configs…). Não há comandos na máquina para ler.
- **Para que serve:** a domótica da casa: luzes, estores, sensores, automações. Se parar, a casa deixa de reagir, por isso o risco conta mais do que noutras apps.
- **As peças:** ha_list_updates mostra o que há por atualizar lá dentro, por grupo:
  - sistema (Supervisor e OS);
  - add-ons;
  - repositórios do HACS;
  - firmware dos dispositivos;
  - outras integrações.

### O que ler

**O Core**
1. As notas de **todas** as versões entre a instalada e a nova (update_release_notes; o blog em home-assistant.io/blog). A secção **"Backward-incompatible changes"** é a que importa: cruza-a com as integrações que estão carregadas (ha_overview).
2. As issues abertas da versão nova (update_known_issues) e as versões de correção que já saíram (x.y.1, x.y.2…).
3. ha_list_updates: o que há por atualizar lá dentro (vai para a secção "## Dentro do Home Assistant").

**Uma peça**
1. O changelog de todas as versões entre a instalada e a nova: o resumo em ha_list_updates e o repositório dela (update_release_notes). Add-ons oficiais: o CHANGELOG no repositório dos add-ons. HACS: as releases no GitHub do repositório.
2. As issues abertas da versão nova (update_known_issues).
3. **Supervisor e OS:** as notas no GitHub (home-assistant/supervisor, home-assistant/operating-system).

### Os pontos do estudo
- [ ] 🤖 **O que se viu da última vez:** os registos dos 2 últimos estudos desta app ou peça (docs_search "Estudo da atualização · Home Assistant", depois docs_read), comparados com agora: a máquina, a instalação e o que ficou "por confirmar no próximo estudo" — prova: os registos lidos e o que mudou (ou "igual", ou "nenhum registo ainda")
- [ ] 🤖 **Benefícios para nós:** o que traz ou corrige para o que usamos, em linguagem simples — prova: a lista (ou "nada que nos sirva")
- [ ] 🤖 **Sem issues graves abertas** (arranque que falha, integrações que deixam de carregar, automações que param, perda de histórico, dispositivos que desaparecem) — prova: os links vistos ou "nenhuma"
- [ ] 🤖 **Só Core · as mudanças que partem coisas:** nenhuma integração carregada aparece nas "Backward-incompatible changes" das versões pelo meio — prova: as integrações cruzadas (ou as que aparecem e o que muda)
- [ ] 🤖 **Só Core · as peças aguentam:** os repositórios do HACS e os add-ons com versão mínima do Core estão compatíveis (as notas deles ou as issues) — prova: a lista (ou as que podem partir)
- [ ] 🤖 **Só Core · o erro de hoje:** ha_system_log antes da atualização, para comparar depois — prova: o número de erros e os principais (ou "sem erros")
- [ ] 🤖 **Só peças · aceita o Core instalado** (versão mínima do Home Assistant nas notas, no manifest ou na ficha do add-on) — prova: a versão do Core e o que a peça pede
- [ ] 🤖 **Só peças · quem a usa:** as automações, os scripts, os painéis ou os dispositivos que dependem dela (ha_list_entities, ha_list_configs) — prova: os nomes (ou "nada")
- [ ] 🤖 **Sem passos à mão** (mudar YAML, refazer uma integração, emparelhar dispositivos de novo) — prova: as notas lidas (ou os passos)
- [ ] 🤖 **O backup do Home Assistant está ativo** (list_backups): ligado, com destino e sem erro — prova: o backup e o estado
- [ ] 🤖 **Salto de versão major** (Core: uma série nova com muitas mudanças incompatíveis; peças: 1.x → 2.0): diz-se no resumo e na recomendação. Não é uma pergunta — prova: "major" com o que muda, ou "não é major"

### Decidir (next do update_save_study)

Segue a tabela de "Instalar ou não" em "Atualizações das apps e do Proxmox – como funcionam": por omissão instala-se, sem esperar dias. O que é desta app:

- **Peças:** instala-se, a não ser que uma automação ou um dispositivo que usamos dependa dela e as notas digam que muda.
- **Core:** o mesmo que as peças, mas as "Backward-incompatible changes" contam muito. Se uma integração carregada aparece lá, o risco é médio ou alto.
- **Pode partir:** uma integração carregada, uma peça que pede um Core mais novo (espera pelo Core, `later`), ou passos à mão (YAML, emparelhar outra vez).
- **Pergunta-se:** passos à mão, ou uma mudança incompatível que mexe numa automação importante.

O Core primeiro, as peças depois.

### O relatório diz sempre

O resumo na forma de "Atualizações das apps e do Proxmox – como funcionam" (porque instalar, porque não, se correr mal). No estudo, também: no Core, as mudanças incompatíveis que nos tocam e uma secção "## Dentro do Home Assistant" com o que há por atualizar por grupo; nas peças, quem a usa.

### Nunca

- Instalar, saltar (update.skip) ou mudar o "atualizar sozinho" durante o estudo.
- Mexer em automações, scripts, cenas, integrações ou add-ons para "preparar" a atualização.
- Restaurar um backup.
- Mostrar o token, palavras-passe ou o conteúdo de secrets.yaml.

## Instalar uma atualização

> **Quando usar:** uma atualização do Home Assistant (o Core ou uma peça lá dentro) em Ready to update (eu pus lá, ou o estudo com install) ou um pedido direto meu.
> **Antes deste:** "Atualizações das apps e do Proxmox – como funcionam" e o estudo ("Home Assistant – estudar uma atualização").

Estar em Ready to update é a aprovação: não se pede outro sim. Os pontos **Só Core** ou **Só peças** valem só para esse tipo; no outro marcam-se "não se aplica".

🤖 o agente verifica · 👤 só eu decido · "prova:" é o que serve de prova

**Regra de ouro:** todos os pontos de "Antes de instalar" passam, cada um com prova. Se um falhar e não se resolver dentro destas regras, não se instala: Waiting for reply com o que falhou e as opções.

### Como se instala

**Uma peça** (Supervisor, OS, add-on, HACS, firmware, outra integração) instala-se pelo próprio Home Assistant, sem comandos no servidor e sem snapshot:

1. **update_prepare** com os pontos de "Antes de instalar" provados.
2. **ha_call_service** `update.install`, com o `backup` só onde a entidade o suporta (o `supported_features` da entidade, em ha_get_entity, tem o bit 8):
   - **Add-ons** (ex.: `supported_features` 29) e **o OS** (`supported_features` 27): `{"entity_id": "<a entidade da tarefa>", "backup": true}`. O Home Assistant guarda uma cópia antes.
   - **HACS, firmware e as outras peças** (ex.: `supported_features` 23): só `{"entity_id": "<a entidade da tarefa>"}`, **sem** `backup`. Com ele, o Home Assistant recusa com o erro 500 "Backup is not supported for update.…" (visto a 14/11/2026 no Bubble Card, no Mushroom, no Sonoff LAN e no Tapo). A cópia que conta é o backup do MyHomeLab de menos de 2 horas.
   - A chamada pode dar timeout (20 s) enquanto o HA faz o backup: não é erro, acompanha-se o `in_progress` da entidade.
3. **Integrações do HACS** (as `custom_components`, não os cartões do painel): depois de instalar, o `release_summary` da entidade diz "Restart of Home Assistant required". Faz parte da atualização:
   - primeiro `homeassistant.check_config` e ha_system_log sem erros novos de configuração;
   - depois `homeassistant.restart`. A chamada pode dar timeout e a API responde 502 durante 1 a 3 minutos: espera-se que volte (ha_overview).
4. **O OS (Home Assistant Operating System):** o Supervisor descarrega e grava a versão nova no outro slot, mas **não reinicia sozinho** (log do Supervisor: "Install of Home Assistant Operating System X success; reboot required"; cria a reparação `reboot_required`). A entidade passa logo a mostrar a versão nova, mas a VM continua na antiga até reiniciar. Prova da versão que corre: `qm agent 102 get-osinfo` (`version-id`).
   - 👤 **O reinício da VM 102 para ativar o OS é com o meu sim**, num pedido à parte: um arranque de um kernel novo pode falhar ou, numa VM KVM, bloquear o host Proxmox inteiro (ex.: a issue #5129 da 18.4). Fica em Waiting for reply com a pergunta, e diz-se se o estudo viu issues de arranque.
   - Se não arrancar, o HAOS volta sozinho ao slot anterior.
5. O MyHomeLab vê a versão nova em até 10 minutos e passa a atualização a Verifying. Depois verifica-se o "feito quando" com **update_verify** (no OS, só depois do reinício).

**O Core:**
- **Como se instala:** como as outras apps, com **update_prepare** (a máquina e os comandos) e **update_run** (com snapshot da VM 102). Se falhar, o MyHomeLab volta sozinho ao snapshot.
- **A máquina e o tipo (confirmados a 14/11/2026, ATU-57):** VM 102 `HomeAssistante`, servidor HomeLab. **Home Assistant OS 18.3 (Open Virtual Appliance)**, visto com `qm agent 102 get-osinfo`. O agente QEMU (10.2.2) tem `guest-exec` ligado (`qm agent 102 info`). O `ha` CLI corre dentro do contentor `hassio_cli`.
- **Teste só de leitura (14/11/2026):** `qm guest exec 102 --timeout 60 -- docker exec hassio_cli ha core info --raw-json` → exitcode 0, `version` 2026.10.0, `version_latest` 2026.11.1.
- **O comando** (`<v>` é a versão nova, ex.: 2026.11.1), um só, para o update_prepare:

```bash
qm guest exec 102 --timeout 1200 -- docker exec hassio_cli ha core update --version <v>
```

  O `--timeout 1200` porque o download da imagem e o arranque do Core podem levar vários minutos (o `qm guest exec` desiste aos 30 s sem ele). O backup do Home Assistant não se pede aqui: conta o do MyHomeLab e o snapshot do update_run. A saída tem de ter `exitcode 0`; depois o update_run espera que o Core responda na versão nova.
- **Ler o estado durante e depois** (só leitura): `qm guest exec 102 --timeout 60 -- docker exec hassio_cli ha core info --raw-json`, `qm guest exec 102 --timeout 60 -- docker exec hassio_cli ha jobs info --raw-json` e, no OS, `... ha os info --raw-json` (`version_pending`) e `qm guest exec 102 --timeout 60 -- docker logs --tail 40 hassio_supervisor`. Atenção: o MyHomeLab conta o `qm guest exec` como alteração e tira antes um snapshot da VM 102; `qm agent 102 get-osinfo` não.
- **Alternativa no Home Assistant OS:** `update.install` em `update.home_assistant_core_update`. Só com o meu sim, porque sem update_run não há snapshot nem volta atrás automática.

### Antes de instalar
- [ ] 🤖 Está em Ready to update: eu pus lá, ou o estudo (install) — prova: o histórico
- [ ] 🤖 Não há outra atualização do Home Assistant (Core ou peça) a correr — prova: o que está a correr, e ha_list_updates sem nada "em curso"
- [ ] 🤖 Há um backup do Home Assistant feito pelo MyHomeLab **há menos de 2 horas** e sem erro; se não, corre-o (run_backup) e espera que acabe bem — prova: a hora e o ficheiro
- [ ] 🤖 O Home Assistant responde e a peça (ou o Core) está na versão de partida (ha_list_updates) — se já estiver na versão nova, não há nada a instalar: passa-se à verificação — prova: as versões
- [ ] 🤖 A versão que vai entrar é a estudada (o "latest" em ha_list_updates). Se for uma correção mais nova da mesma linha, instala-se na mesma; se for outra linha ou major, pergunta-se — prova: as versões
- [ ] 🤖 Os erros de antes: ha_system_log, para comparar depois — prova: o número e os principais (ou "sem erros")
- [ ] 🤖 **Só Core:** a máquina e o comando estão confirmados neste documento (senão, Waiting for reply como diz "O Core") — prova: a secção
- [ ] 🤖 **Só peças · firmware:** o dispositivo está ligado e com bateria ou corrente (um firmware interrompido pode estragar o dispositivo) — prova: o estado da entidade

### Depois de instalar
- [ ] 🤖 A versão nova aparece instalada (ha_list_updates ou ha_overview; no OS, também `qm agent 102 get-osinfo` depois do reinício) — prova: a versão
- [ ] 🤖 Sem erros novos em ha_system_log desde a atualização, sobretudo da peça ou das integrações carregadas — prova: as linhas novas ou "nenhuma"
- [ ] 🤖 As integrações carregadas são as mesmas de antes (ha_overview) — prova: as que faltam ou "todas"
- [ ] 🤖 O que a usa continua a funcionar: as automações dela estão ligadas (ha_list_configs) e as entidades dela têm estado recente, não "unavailable" (ha_list_entities) — prova: o que se viu
- [ ] 🤖 **Só Core:** correu um backup novo pelo MyHomeLab — prova: a hora e o resultado

### Se falhar

Segue "Quando falha" em "Atualizações das apps e do Proxmox – como funcionam": a atualização fica em In progress, investiga-se, e o que é simples e seguro corrige-se e corre-se outra vez no mesmo processo (até 3 corridas). O que é desta app:

- **Onde ver:** ha_system_log, o estado da peça em ha_list_updates e se as entidades dela estão "unavailable". No Core também `qm guest exec 102 --timeout 60 -- docker exec hassio_cli ha core logs` (só as últimas linhas, sem segredos).
- **Core:** diz-se se o MyHomeLab voltou ao snapshot e se o HA responde (o arranque pode levar alguns minutos).
- **"Backup is not supported"** (500) no `update.install`: a entidade não aceita `backup`; repete-se sem ele (o backup do MyHomeLab de menos de 2 horas já cobre).
- **"Open the Marketplace and read the warning first"** (500) no `update.install` de uma peça do HACS: o Marketplace tem um aviso por aceitar e só eu o aceito na interface (visto a 14/11/2026 no Ookla, no TP-Link Router e no UI Lovelace Minimalist). Não se contorna nem se repete: update_attempt_close e Waiting for reply, a pedir que o aceite. Enquanto não o aceitar, nenhuma peça do HACS se instala: as outras em Ready to update ficam à espera com a mesma pergunta, sem tentar.
- **Peça:** não há volta atrás automática. Uma peça do HACS que não carrega costuma resolver-se recarregando a integração (ha_call_service `homeassistant.reload_config_entry`), e isso pode fazer-se. Voltar à versão anterior ou restaurar um backup é comigo.

### Nunca

- Instalar mais do que a peça da tarefa, ou várias peças de uma vez.
- Usar update.skip, mudar o "atualizar sozinho", desinstalar add-ons ou integrações, ou mexer na configuração delas.
- Restaurar backups ou voltar a um snapshot sem o meu sim (fora do rollback automático do update_run).
- Reiniciar o Home Assistant ou o host fora de uma atualização que o peça (uma integração do HACS com "Restart of Home Assistant required" pede-o). Reiniciar a VM 102 para ativar um OS novo é sempre com o meu sim.
- Mostrar o token, palavras-passe ou o conteúdo de secrets.yaml.
