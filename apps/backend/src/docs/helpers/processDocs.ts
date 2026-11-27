import { DocKind } from 'src/generated/prisma/client/client';
import type { StarterDoc } from './starterDocs';

// Os documentos gerais de processo: valem para tudo e os prompts dos agentes
// nomeiam-nos pelo título ("Como a equipa trabalha"…), por isso os títulos não mudam.
// São do utilizador: os agentes seguem-nos e propõem mudanças com docs_propose.

const TEAM: StarterDoc = {
  title: 'Como a equipa trabalha',
  kind: DocKind.RULES,
  tags: ['processo', 'equipa'],
  summary:
    'Como os agentes se organizam: quem faz o quê, os três tipos de documentos, quando perguntam e como deixam registo.',
  links: [],
  content: `# Como a equipa trabalha

## Quem faz o quê
- O **Jarvis** recebe os pedidos e passa cada um ao agente da área (servidores, email, viagens, saúde…). Junta as respostas e responde.
- Cada agente só mexe na sua área, com as ferramentas que tem.

## Os documentos
- **Regras** — o que se pode fazer e como se faz. São minhas: os agentes seguem-nas e, quando falta ou está errada uma regra, propõem a mudança (docs_propose) e eu aprovo em Documentos ou no cartão do chat.
- **Mapa** — o que existe num servidor ou numa app (máquinas, versões, portas, add-ons). É dos agentes: mantêm-no em dia sempre que estudam ou mudam alguma coisa.
- **Registo** — o que se fez (estudos, instalações, comandos). Escrito pelos agentes, fica no Histórico.
- Entre dois documentos ganha o mais específico (o de uma app ao geral). Se se contradizem, diz-mo.

## Antes de agir
- Ler as regras e o mapa do que se vai mexer.
- Se o pedido não for claro, perguntar uma vez, com as opções.

## Perguntar
- Só pergunto o que precisa mesmo de mim: um risco real para os meus dados ou para a casa, algo que não se desfaz, ou uma escolha que só eu posso fazer.
- As perguntas chegam-me às notificações. Uma pergunta de cada vez, com a recomendação.

## Depois de agir
- Confirmar que ficou a funcionar e deixar registo (docs_log, ou update_add_note nas atualizações).
- Se o mapa mudou, atualizá-lo.
- Se aprendeste algo que devia ser regra, propõe-na no documento certo.
`,
};

const UPDATES: StarterDoc = {
  title: 'Atualizações das apps e do Proxmox – como funcionam',
  kind: DocKind.RULES,
  tags: ['atualizacao', 'processo'],
  summary:
    'O caminho de uma atualização no quadro (estudar, decidir, instalar, verificar): nunca se instala sem o meu sim.',
  links: [],
  content: `# Atualizações das apps e do Proxmox – como funcionam

Este documento manda no caminho e nas decisões. O que é próprio de cada app (onde corre, comandos, o que verificar) está nas regras dela, e segue-se à letra.

🤖 o agente faz · 👤 só eu decido · "prova:" é o que serve de prova

## O caminho (as colunas do quadro)

\`\`\`
Todo ──👤──→ Espera por estudo → Study ─┬→ Waiting for reply ──👤──→ Ready to update → In progress → Verifying → Done
                                        └→ Recheck later (só com uma razão concreta)
\`\`\`

1. **Estudar.** 🤖 Uma de cada vez. Só lê e mede: as notas da versão (update_release_notes), as issues abertas (update_known_issues) e o histórico das atualizações anteriores da mesma app.
2. **Decidir.** 🤖 Com a tabela abaixo.
3. **Instalar.** 🤖 update_prepare → update_check em cada ponto, com prova → update_prepare com checklist [] → update_run. Acompanha com update_status até acabar.
4. **Verificar.** 🤖 Em Verifying, os pontos de "Depois de instalar" (update_verify). Tudo bem → Done. Um problema → Waiting for reply com o que se viu.

### Como entra no quadro
Uma versão nova fica primeiro só disponível, sem tarefa: abro-a eu, ou o cron job das atualizações da app, se eu o liguei com "Pôr no projeto".

## Instalar ou não

O estudo responde a três perguntas, com prova:
1. **O que ganhamos?** Correções de segurança, bugs que nos afetam, coisas que usamos — ou "nada que nos sirva".
2. **O que pode partir para nós?** Só o que toca no que temos: mudanças incompatíveis, issues graves abertas, passos à mão.
3. **Se correr mal, volta-se atrás?** Com o snapshot do update_run e o backup do CT/VM em dia, sim.

| Situação | Fica em |
|---|---|
| Nada parte para nós e volta-se atrás | Waiting for reply, com a recomendação de instalar |
| Uma issue grave aberta que nos afeta, com correção a caminho | Recheck later |
| Salto major, risco alto, passos à mão, ou o host | Waiting for reply, com a recomendação e o porquê do cuidado |
| Uma escolha que só eu faço | Waiting for reply, com a pergunta |

## O resumo do estudo

\`\`\`
<app> X → Y · risco baixo|médio|alto · <recomendo instalar | espero por … | preciso de ti>
✅ Porque instalar: 1–3 pontos concretos
⚠️ Porque não: 1–3 pontos concretos que nos tocam
↩️ Se correr mal: snapshot + backup (ou o que houver)
\`\`\`

## Quando falha
1. Ler o erro e as últimas linhas do log da app; ver se a app responde na versão antiga depois do snapshot.
2. Se a causa for clara e a solução simples e segura, contorna-se e tenta-se outra vez.
3. Se não, Waiting for reply com o que se viu e o que se propõe.
`,
};

const SERVICE_DOWN: StarterDoc = {
  title: 'Serviço em baixo – como se trata',
  kind: DocKind.RULES,
  tags: ['servico', 'alerta', 'processo'],
  summary:
    'Quando um serviço vigiado vai abaixo: estudar a causa, o que se pode resolver sozinho e quando se pergunta.',
  links: [],
  content: `# Serviço em baixo – como se trata

Quando uma verificação falha, o MyHomeLab abre o alerta, cria a tarefa e pede ao agente dos servidores para estudar porque caiu.

## Estudar (só ler)
- A máquina onde corre está ligada? Tem disco, memória e CPU?
- O serviço está a correr? O que dizem as últimas linhas do log?
- Responde por dentro (na própria máquina) e não por fora? Então é rede, proxy ou DNS.
- Mudou alguma coisa há pouco (uma atualização, uma configuração)? Ver os registos.

## Resolver sozinho
- Reiniciar o serviço ou a máquina, se as regras dela o permitem e não há dados em risco.
- Libertar espaço apagando caches ou imagens antigas que as regras da app autorizam.

## Perguntar primeiro
- Repor um snapshot ou um backup, mudar recursos, apagar dados, ou qualquer coisa que não se desfaz.

## No fim
- Dizer a causa, o que se fez e se voltou. O alerta fecha sozinho quando o serviço responde.
- A tarefa: quando o serviço volta, o MyHomeLab passa-a a Verifying e, estável 10 minutos, fecha-a (Done). Se precisas de uma resposta dele, deixa-a em Waiting for reply: aí não lhe toca.
- Durante uma atualização dessa app (ou do Proxmox) não se abre tarefa: a falha fica dita na tarefa da atualização.
- Deixar registo e, se aprendeste algo, propor a regra.
`,
};

const UNATTENDED: StarterDoc = {
  title: 'Quando corro sem ti',
  kind: DocKind.RULES,
  tags: ['disparo', 'processo'],
  summary:
    'O que os agentes podem fazer sozinhos quando correm num disparo agendado, sem ninguém a acompanhar.',
  links: [],
  content: `# Quando corro sem ti

Nos disparos (Projetos → Disparos) ninguém está a acompanhar. Vale tudo o que as regras dizem, e mais isto:

## Pode
- Ler, medir, estudar e fazer relatórios.
- Fazer o que as regras de uma app ou de um servidor dizem que se faz sozinho (ex.: instalar uma atualização em Ready to update).

## Não pode
- Nada que deixe serviços em baixo fora do que as regras permitem.
- Nada que não se desfaz, nem mudar regras.

## Quando precisa de mim
- Pára, deixa a pergunta nas notificações (ou a tarefa em Waiting for reply) e segue com o resto.
`,
};

const MAP_HOWTO: StarterDoc = {
  title: 'Mapa do servidor – como se escreve',
  kind: DocKind.RULES,
  tags: ['mapa', 'processo'],
  summary:
    'Como os agentes escrevem e mantêm o mapa de um servidor ou de uma app: o que lá existe, sem regras.',
  links: [],
  content: `# Mapa do servidor – como se escreve

O mapa diz **o que existe**, não o que se pode fazer (isso são as regras). É dos agentes: criam-no com docs_write (tipo MAP), ligado ao servidor ou à app, e mantêm-no em dia.

## O que tem
- **Servidor:** o hardware, os discos e os armazenamentos, a rede.
- **Máquinas:** cada CT e VM com o id, o nome, o que corre lá, os recursos e o IP.
- **Apps:** a versão, onde corre, as portas, onde estão os dados e os backups.
- **Ligações:** o que depende de quê (proxy, DNS, base de dados).

## Como se escreve
- Curto, em tabelas e listas. Só factos que se viram, com a data.
- Sem segredos (tokens, passwords).
- Quando algo muda (uma instalação, uma máquina nova), atualizar o mapa logo a seguir.
`,
};

export const PROCESS_DOCS: StarterDoc[] = [
  TEAM,
  UPDATES,
  SERVICE_DOWN,
  UNATTENDED,
  MAP_HOWTO,
];
