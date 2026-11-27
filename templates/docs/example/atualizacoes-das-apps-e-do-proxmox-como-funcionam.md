---
title: Atualizações das apps e do Proxmox – como funcionam
kind: RULES
tags: [atualizacao, processo]
summary: O caminho de uma atualização (apps e host Proxmox), o que o agente faz sozinho (instala o que não é major e avisa no fim), o que espera pelo meu sim e o que me chega às Notificações.
agents: [infra]
---
# Atualizações das apps e do Proxmox – como funcionam

> **Quando usar:** sempre que se estuda, instala ou verifica uma atualização de uma app ligada (Forgejo, Nextcloud e as apps lá dentro, openGym, TREK, AdGuard, Home Assistant e as peças lá dentro) ou do host Proxmox.
> **Não serve para:** mexer nas máquinas (CT e VM) por outras razões, nem para escrever o guia do servidor.

Este documento manda no caminho e nas decisões. Os pormenores de cada app (onde corre, comandos, o que verificar) estão no documento de regras dela, nas secções "Estudar uma atualização" e "Instalar uma atualização", e seguem-se à letra.

| App | O documento |
|---|---|
| Forgejo | "Forgejo – regras" |
| Nextcloud (o servidor e as apps lá dentro) | "Nextcloud – regras" |
| openGym | "openGym – regras" |
| TREK | "TREK – regras" |
| AdGuard Home (o DNS da casa) | "AdGuard – regras" |
| Home Assistant (o Core e as peças) | "Home Assistant – regras" |
| Proxmox (o host) | "Proxmox – regras" |

🤖 o agente faz · 👤 só eu decido · "prova:" é o que serve de prova

## A ideia

**Por omissão, instala-se.** O agente estuda, decide, instala, verifica e resolve os problemas pequenos sozinho. Só me chega o que é mesmo chato: um risco real para os meus dados ou para a casa, algo que não se desfaz, ou uma escolha que só eu posso fazer.

**Não há regras de horas nem de dias.** Instala-se a qualquer hora, logo que esteja pronta, e não se espera "X dias depois de sair". Só se espera por uma razão concreta, como uma issue grave aberta que nos afeta, e diz-se qual é.

## O caminho (as colunas do quadro)

```
Espera por estudo → Study ─┬→ Ready to update → In progress → Verifying → Done
                           ├→ Waiting for reply ──👤──→ Ready to update
                           └→ Recheck later (só com uma razão concreta)
```

1. **Estudar.** 🤖 Uma de cada vez, com o "estudar" da app. Só lê e mede.
   - Começa pelos 2 últimos registos da mesma app ("Estudo da atualização · <app> …"): o que mudou desde então e o que correu mal da última vez.
2. **Validar e decidir.** 🤖 Mede também os pontos de "Antes de instalar" da app (espaço, backup, a app a responder), sem mudar nada. Depois decide com a tabela de "Instalar ou não", abaixo: tudo certo → `install`, e instala-se logo. O que falta e tem uma solução segura (ver "O que o agente faz sozinho") não impede o `install`: resolve-se no início da instalação.
3. **Instalar.** 🤖 Com o "instalar" da app: update_prepare → update_check em cada ponto, com prova → update_prepare com checklist [] → update_run. Depois, update_status até acabar (espera sozinho até um minuto por chamada); não se acaba a tarefa com os comandos a correr.
4. **Verificar.** 🤖 Em Verifying, os pontos de "Depois de instalar" (update_verify). Se tudo estiver bem, passa a Done e chega-me "Instalado". Se houver um problema (ou a verificação não acabar), passa a Waiting for reply com o que se viu e chega-me a pergunta: não fica em Verifying, que pára a fila das outras.
5. **Se falhar:** ver "Quando falha".

### Como entra no quadro

Uma versão nova fica primeiro só disponível (sem tarefa nem registo). Entra no quadro, sempre em **Espera por estudo**, pelo cron job das atualizações da app (na página da app → Cron jobs, ligado com "Pôr no projeto"). Ligo-o eu, ou peço ao assistente (update_cron_set). Também a posso abrir eu à mão.

Logo a seguir, o MyHomeLab cria sozinho o disparo "Estudar <app> <versão>" nos Disparos do projeto, e o agente estuda-a. Não é preciso criar disparos à mão.

## Instalar ou não

O estudo responde a três perguntas, cada uma com prova.

**1. O que ganhamos?**
- correções de segurança;
- bugs que nos afetam;
- coisas que usamos;
- "nada que nos sirva" também é uma resposta.

**2. O que pode partir para nós?** Só conta o que toca no que temos:
- as mudanças incompatíveis que mexem nas nossas integrações, configuração ou ligações do MyHomeLab;
- as issues graves abertas que nos afetam, como perda de dados, um arranque que falha ou um login partido;
- os passos à mão.

**3. Se correr mal, volta-se atrás?**
- Volta, se houver snapshot e backup em dia.
- No host, e nas peças do HA (só têm o backup), a resposta é diferente.

**A decisão (next do update_save_study):**

| Situação | next | Fica em |
|---|---|---|
| Nada parte para nós e volta-se atrás | `install` | Ready to update: instala-se já |
| Uma issue grave aberta que nos afeta, com correção a caminho | `later` (os dias até à correção prevista; sem data, 7) | Recheck later |
| Salto major, risco alto, passos à mão, ou o host com risco médio ou alto | `recommend` | Waiting for reply, com a recomendação |
| Uma escolha que só eu faço (um passo que muda privacidade ou dados, algo que não se desfaz) | `waiting` | Waiting for reply, com uma pergunta |

- **Risco:**
  - **baixo:** nada nos toca;
  - **médio:** toca em algo nosso, mas está explicado nas notas e volta-se atrás;
  - **alto:** pode partir dados ou a casa, ou não se volta atrás.
- **Majors:** o MyHomeLab não deixa instalar sozinho um salto major, risco alto, passos à mão nem o host sem risco baixo. Nesses casos fica a recomendação e eu decido.
- **Sem ganho:** se não traz nada que nos sirva e o risco é baixo, instala-se na mesma, para não ficar para trás.

## O resumo do estudo (o que me chega)

Curto e objetivo, sempre com esta forma:

```
<app> X → Y · risco baixo|médio|alto · <instalo já | recomendo instalar | espero por … | preciso de ti>
✅ Porque instalar: 1–3 pontos concretos (ou "nada que nos sirva")
⚠️ Porque não: 1–3 pontos concretos que nos tocam (ou "nada que nos toque")
↩️ Se correr mal: snapshot + backup (ou o que houver)
```

No campo `summary` vai isto. Os pormenores (o que se leu, os links, as medições) ficam no `study`. Sem texto genérico do tipo "é sempre bom atualizar" ou "pode haver riscos".

## O que o agente faz sozinho

**Pode, sem me perguntar:**
- Estudar, instalar e verificar tudo o que a tabela manda instalar.
- Pedir um backup do CT/VM no Proxmox (pve_backup_now, pelo Operador Proxmox), tirar o snapshot (update_run) e limpar as caches e as imagens antigas que o documento da app autoriza.
- Resolver um ponto de "Antes de instalar" que falha, quando a solução é segura: fazer o backup do CT/VM que falta, libertar espaço apagando caches ou imagens antigas, aumentar 10% o disco ou a memória de uma máquina acima do limite, esperar que a app acabe de arrancar.
- Contornar uma falha da instalação, como diz "Quando falha".
- Corrigir no documento da app um comando, um caminho ou um formato que se provou estar errado (docs_write, fica a versão anterior), e dizer-mo no relatório.
- Marcar como "não se aplica" um ponto que nenhuma ferramenta consegue ver, com o porquê.

**Espera por mim (Waiting for reply):** só o que está na tabela (`recommend` e `waiting`), e:
- reiniciar o host;
- aumentar um disco ou os recursos de uma máquina mais do que esses 10%;
- restaurar um backup, ou voltar a um snapshot fora do update_run;
- mudar uma regra de segurança de um documento: isso é por proposta (docs_propose), não por docs_write.

## Quando falha

**Uma falha não é o fim: investiga-se dentro do mesmo processo.** Quando uma corrida do update_run falha, o MyHomeLab volta ao snapshot e a atualização **fica em In progress**: não volta a Ready to update nem passa a Failed enquanto o agente estiver a tratar dela. O update_status diz "A corrida N de 3 falhou".

1. **Ler o erro:** o comando que falhou, a saída e as últimas linhas do log da app (o "instalar" diz onde estão). Ver se a app responde na versão antiga depois do snapshot.
2. **Perceber a causa:**
   - procurar o erro nas issues e nas notas da versão (update_known_issues, update_release_notes);
   - comparar com os registos das instalações anteriores.
3. **Se a causa for clara e a solução simples e segura, contorna-se e tenta-se outra vez.** Por exemplo:
   - um comando ou um formato errado no documento;
   - um timeout curto;
   - falta de espaço que se liberta com caches ou imagens antigas;
   - um ficheiro temporário que ficou de uma tentativa anterior;
   - uma dependência que a própria app manda instalar.

   Como se faz, sem sair do processo:
   - antes de correr outra vez, confirma-se que a correção resolve, com um comando só de leitura se der (ex.: ver o formato do ficheiro, o espaço livre);
   - corrige-se o documento da app (docs_write) com o que se viu;
   - update_prepare com os comandos corrigidos e update_run outra vez, com snapshot.

   **No máximo 3 corridas** por instalação (a primeira e mais 2).
4. **Se a causa não for clara, a solução não for simples, ou já houve 3 corridas:** update_set_status waiting, com uma mensagem curta:
   - o que falhou;
   - a causa provável;
   - o que já se tentou;
   - as opções, com a que recomendas.

**Nunca se contorna:**
- com algo que mexa nos dados (apagar tabelas, utilizadores, ficheiros dos utilizadores);
- desligando uma verificação de segurança (checksums, assinaturas);
- saltando o backup ou o snapshot.

## Uma pergunta bem feita

- Só se pergunta o que eu tenho mesmo de decidir. O que se pode ler, medir ou experimentar com segurança, faz-se antes.
- Uma só pergunta, com as opções e o que recomendas, em linguagem simples.
- Pôr em Ready to update é o sim a tudo o que o estudo disse: não se pede outro.

## O que me chega às Notificações

- **Precisa de ti:** uma atualização em Waiting for reply, ou uma proposta de documento.
- **Avisos:**
  - "Instalado: <app> <versão>";
  - "Falhou: <app> <versão>", só quando se desistiu de contornar;
  - um documento corrigido pelo agente, dito no relatório da instalação.

Estudos, esperas, tentativas e verificações ficam só na tarefa.

## Backups e snapshots

- **Apps:** antes de instalar, um backup do CT/VM no Proxmox com menos de 24 h (pve_backup_now, pelo Operador Proxmox) e o snapshot da máquina (update_run com snapshot). O MyHomeLab já não faz backups das apps. Se a instalação falhar, o MyHomeLab volta sozinho a esse snapshot: faz parte da instalação.
- **Peças do Home Assistant:** sem snapshot do update_run; o `backup` do próprio HA onde a entidade o aceita, ou um snapshot da VM tirado antes (pve_create_snapshot, pelo Operador Proxmox).
- **Proxmox:** sem snapshot; o backup da configuração é obrigatório.

## Nunca

- Instalar sozinho o que a tabela manda para mim.
- Saltar um ponto de "Antes de instalar", o backup ou o snapshot.
- Atualizar duas coisas da mesma máquina ao mesmo tempo.
- Mostrar palavras-passe, tokens ou chaves no chat, em tarefas ou em documentos.
