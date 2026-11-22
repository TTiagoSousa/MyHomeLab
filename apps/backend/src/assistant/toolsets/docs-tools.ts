import { chatDecisionBlock } from 'src/chat-approval/helpers/chatDecisionBlock';
import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  DocKind,
  DocLinkType,
  DocOwner,
  DocProposalAction,
} from 'src/generated/prisma/client/client';
import { describeDoc } from 'src/docs/docs.service';
import {
  mergeLinks,
  ProposalOrganize,
} from 'src/docs/helpers/proposalOrganize';
import { DOC_THING_LINK_TYPES, docAutoGroup } from '@myhomelab/shared';
import { lisbonStamp } from 'src/utils/lisbonTime';

/** Onde o utilizador vê o documento na página Documentos (a mesma regra da página). */
function placeOf(
  doc: { tags: string[]; links: { type: DocLinkType; label: string }[] },
  sectionName: string | null,
): string {
  if (sectionName) return `na secção "${sectionName}"`;
  const group = docAutoGroup(doc);
  if (group === 'things') {
    const link = doc.links.find((item) =>
      (DOC_THING_LINK_TYPES as readonly string[]).includes(item.type),
    );
    return `em "Servidores e apps" → ${link?.label ?? '?'}`;
  }
  if (group === 'projects') {
    const link = doc.links.find((item) => item.type === DocLinkType.PROJECT);
    return `em "Projetos" → ${link?.label ?? '?'}`;
  }
  return `em "Gerais" (${doc.tags.includes('processo') ? 'tem a etiqueta processo' : 'sem ligação a servidor, máquina, app, monitor ou projeto'})`;
}

const DOC = {
  type: 'string' as const,
  description: 'O documento: o id (do índice) ou o título.',
};

const KINDS = Object.values(DocKind);

const LINKS = {
  type: 'array' as const,
  description:
    'A que o documento fica ligado. type: SERVER (id do servidor), GUEST ("<id do servidor>:<vmid>"), APP (id da app ligada), MONITOR, AGENT (chave), DOC (id), PROJECT (id do projeto, de docs_projects). label: o nome a mostrar.',
  items: {
    type: 'object' as const,
    properties: {
      type: { type: 'string' as const, enum: Object.values(DocLinkType) },
      targetId: { type: 'string' as const },
      label: { type: 'string' as const },
    },
    required: ['type', 'targetId', 'label'],
  },
};

type LinkInput = { type: DocLinkType; targetId: string; label: string }[];

// As definições são fixas (a cache vive do prefixo igual); só os handlers leem
// os documentos deste utilizador.
export function buildDocsTools(context: AgentContext): AgentTool[] {
  const agentKey = context.agentKey ?? 'agente';

  return [
    {
      name: 'docs_search',
      description:
        'Procura nos documentos do utilizador (regras, mapas dos servidores e das apps, registos) por palavras, no título, no texto, nas etiquetas e no que estão ligados. Devolve a linha do índice e um pedaço do texto.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'As palavras a procurar.' },
          kind: { type: 'string', enum: KINDS },
        },
        required: ['query'],
      },
      handler: async (input: { query: string; kind?: DocKind }) => {
        const docs = await context.docs.list(context.userId, {
          search: input.query,
          kind: input.kind,
        });
        if (!docs.length) return `Nenhum documento fala de "${input.query}".`;
        return docs
          .slice(0, 15)
          .map((doc) => `${describeDoc(doc)}\n  «${doc.snippet}»`)
          .join('\n');
      },
    },
    {
      name: 'docs_read',
      description:
        'Lê um documento inteiro (Markdown). Lê os documentos ligados a uma coisa antes de mexer nela.',
      inputSchema: {
        type: 'object',
        properties: { doc: DOC },
        required: ['doc'],
      },
      handler: async (input: { doc: string }) => {
        const doc = await context.docs.findForAgent(context.userId, input.doc);
        if (typeof doc === 'string') return doc;
        context.docsUsed?.set(doc.id, doc.title);
        const section = doc.sectionId
          ? await context.docs.findSection(context.userId, doc.sectionId)
          : null;
        return (
          `${describeDoc(doc)}\n` +
          `Na página Documentos aparece ${placeOf(doc, section?.name ?? null)}.\n` +
          `Dono: ${doc.owner === DocOwner.USER ? 'o utilizador (não escreves; propões com docs_propose)' : 'os agentes (podes reescrever com docs_write)'}. ` +
          `Atualizado a ${lisbonStamp(doc.updatedAt)} por ${doc.updatedBy ?? '—'}.\n\n` +
          (doc.content.trim() || '(vazio)')
        );
      },
    },
    {
      name: 'docs_projects',
      description:
        'Os projetos dele (a empresa, uma página, um blog…): o que são, que agentes trabalham neles e quantos documentos têm. Os documentos de um projeto dizem como agir por ele (tom, regras da marca, o que nunca fazer): lê-os antes de fazer alguma coisa para esse projeto.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const projects = await context.projects.list(context.userId);
        if (!projects.length)
          return 'Ainda não há projetos (ele cria-os em Projetos).';
        return projects
          .map(
            (project) =>
              `- ${project.name} (${project.id}) — ${project.description || 'sem descrição'} · agentes: ${project.agentKeys.join(', ') || 'nenhum'} · ${project.docCount} documentos (docs_search ou o índice: ligados a PROJECT ${project.name})`,
          )
          .join('\n');
      },
    },
    {
      name: 'docs_write',
      description:
        'Cria um documento teu (dos agentes) ou reescreve um que seja dos agentes — quase sempre o mapa (MAP) de um servidor ou de uma app: o que lá existe (versões, máquinas, portas, add-ons). Cada servidor e cada app ligada já tem um "Mapa – …" gerado pelo MyHomeLab (etiqueta mapa-auto) e refeito todos os dias: nesse, mantém tudo e escreve só na secção "## Notas" do fim (o resto é reescrito). Regras não se escrevem aqui: propõem-se com docs_propose.',
      inputSchema: {
        type: 'object',
        properties: {
          doc: {
            type: 'string',
            description: 'Para reescrever: o id ou o título. Omite para criar.',
          },
          title: { type: 'string' },
          kind: { type: 'string', enum: KINDS },
          content: {
            type: 'string',
            description:
              'O texto completo em Markdown (títulos ##, listas, - [ ] caixas, tabelas, ```mermaid para diagramas).',
          },
          summary: {
            type: 'string',
            description: 'Uma linha para o índice: do que trata.',
          },
          tags: { type: 'array', items: { type: 'string' } },
          links: LINKS,
        },
        required: ['content'],
      },
      handler: async (input: {
        doc?: string;
        title?: string;
        kind?: DocKind;
        content: string;
        summary?: string;
        tags?: string[];
        links?: LinkInput;
      }) => {
        const author = { kind: 'agent' as const, key: agentKey };
        // Uma regra escrita por um agente valia como uma regra dele. As regras só
        // nascem por docs_propose, que ele aprova.
        if (input.kind === DocKind.RULES) {
          return 'Regras não se escrevem aqui: propõe-nas com docs_propose (ele aprova). Para o que viste ou fizeste, usa MAP ou LOG.';
        }
        if (input.doc) {
          const doc = await context.docs.findForAgent(
            context.userId,
            input.doc,
          );
          if (typeof doc === 'string') return doc;
          if (doc.owner !== DocOwner.AGENT || doc.kind === DocKind.RULES) {
            return `"${doc.title}" é do utilizador: propõe a mudança com docs_propose (ele aprova em Documentos).`;
          }
          await context.docs.update(
            context.userId,
            doc.id,
            {
              title: input.title,
              kind: input.kind,
              content: input.content,
              summary: input.summary,
              tags: input.tags,
              links: input.links,
            },
            author,
          );
          return `Documento "${input.title ?? doc.title}" reescrito (a versão anterior ficou guardada).`;
        }
        if (!input.title?.trim())
          return 'Para criar um documento falta o título.';
        const doc = await context.docs.create(
          context.userId,
          {
            title: input.title,
            kind: input.kind ?? DocKind.MAP,
            content: input.content,
            summary: input.summary,
            tags: input.tags,
            links: input.links,
          },
          author,
        );
        return `Documento "${doc.title}" criado (${doc.id}). O utilizador vê-o em Documentos.`;
      },
    },
    {
      name: 'docs_log',
      description:
        'Deixa um registo do que fizeste (um documento LOG, que o utilizador vê em Documentos → Registos): os comandos que correste, o que saiu, os erros e se ficou tudo bem. Acrescenta uma entrada com a hora ao registo com esse título (cria-o se não houver). Usa-o depois de mudar alguma coisa (num servidor, numa app, numa configuração). As atualizações das apps já têm registo próprio (update_add_note).',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'O registo, por assunto (ex.: "Registo · AdGuard · listas de bloqueio", "Registo · pve1 · discos"). O mesmo título junta as entradas.',
          },
          entry: {
            type: 'string',
            description:
              'Markdown: o que pediste e porquê, os comandos (```bash), o que saiu (resumido), os erros e o resultado (✅/❌).',
          },
          summary: {
            type: 'string',
            description: 'Uma linha: do que trata este registo.',
          },
          links: LINKS,
        },
        required: ['title', 'entry'],
      },
      handler: async (input: {
        title: string;
        entry: string;
        summary?: string;
        links?: LinkInput;
      }) => {
        if (!input.title?.trim() || !input.entry?.trim()) {
          return 'Faltam o título e a entrada do registo.';
        }
        const doc = await context.docs.appendLog(
          context.userId,
          {
            title: input.title,
            entry: input.entry,
            summary: input.summary,
            links: input.links,
          },
          { kind: 'agent', key: agentKey },
        );
        return `Registo "${doc.title}" atualizado (${doc.id}). O utilizador vê-o em Documentos → Registos.`;
      },
    },
    {
      name: 'docs_layout',
      description:
        'Mostra os documentos como ele os vê na página Documentos. Em cima ficam as secções dele (pastas que ele cria: "Viagens", "Casa", "Saúde"…), com os documentos de cada uma. Por baixo, os documentos que não estão numa secção, arrumados sozinhos em três grupos: "Servidores e apps" (ligados a um servidor, máquina, app ou monitor, junto dessa coisa), "Projetos" (ligados a um projeto) e "Gerais" (o resto, e sempre os da etiqueta processo, mesmo ligados). As etiquetas não criam grupos. Para tirar um documento de Gerais: põe-no numa secção, ou liga-o à app ou ao servidor certo (sem a etiqueta processo). Os registos (LOG) não aparecem aqui: ficam em Documentos → Registos. Usa isto antes de propor arrumações.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const layout = await context.docs.layout(context.userId);
        const { sections } = layout;
        // Os registos ficam à parte (Documentos → Registos), como na página.
        const docs = layout.docs.filter((doc) => doc.kind !== DocKind.LOG);
        const childrenOf = new Map<string, typeof docs>();
        for (const doc of docs) {
          if (doc.parentId && docs.some((item) => item.id === doc.parentId)) {
            childrenOf.set(doc.parentId, [
              ...(childrenOf.get(doc.parentId) ?? []),
              doc,
            ]);
          }
        }
        const topLevel = docs.filter(
          (doc) =>
            !doc.parentId || !docs.some((item) => item.id === doc.parentId),
        );
        const docLines = (items: typeof docs, indent: string): string[] =>
          items.flatMap((doc) => [
            `${indent}- [${doc.kind}] ${doc.title} (${doc.id})${doc.tags.length ? ` #${doc.tags.join(' #')}` : ''}`,
            ...docLines(childrenOf.get(doc.id) ?? [], `${indent}    `),
          ]);
        const sectionLines = (
          parentId: string | null,
          indent: string,
        ): string[] =>
          sections
            .filter((section) => section.parentId === parentId)
            .flatMap((section) => {
              const inside = topLevel.filter(
                (doc) => doc.sectionId === section.id,
              );
              return [
                `${indent}📁 ${section.name} (${section.id}) — ${inside.length} documentos`,
                ...docLines(inside, `${indent}  `),
                ...sectionLines(section.id, `${indent}  `),
              ];
            });

        const automatic = topLevel.filter((doc) => !doc.sectionId);
        const byFirstLink = (group: 'things' | 'projects', types: string[]) => {
          const groups = new Map<string, typeof docs>();
          for (const doc of automatic.filter(
            (item) => item.autoGroup === group,
          )) {
            const link = doc.links.find((item) => types.includes(item.type));
            const key = link?.label ?? '?';
            groups.set(key, [...(groups.get(key) ?? []), doc]);
          }
          return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([label, items]) => [
              `  ▸ ${label}`,
              ...docLines(items, '    '),
            ]);
        };
        const general = automatic.filter((doc) => doc.autoGroup === 'general');
        const lines = [
          `As tuas secções (${sections.length}):`,
          ...(sections.length
            ? sectionLines(null, '')
            : [
                '(nenhuma — ele cria-as em Documentos → "Nova secção", ou propões com docs_propose section)',
              ]),
          '',
          'Automático — fora das secções:',
          'Servidores e apps:',
          ...byFirstLink('things', ['SERVER', 'GUEST', 'APP', 'MONITOR']),
          'Projetos:',
          ...byFirstLink('projects', ['PROJECT']),
          `Gerais (${general.length}):`,
          ...general.flatMap((doc) => [
            ...docLines([doc], '  '),
            `      porquê: ${doc.tags.includes('processo') ? 'tem a etiqueta processo' : 'não está ligado a servidor, máquina, app, monitor nem projeto'}`,
          ]),
        ];
        return lines.join('\n');
      },
    },
    {
      name: 'docs_targets',
      description:
        'Tudo a que um documento se pode ligar, com o id a usar em links / add_links: servidores e as máquinas deles (GUEST "<servidor>:<vmid>"), apps ligadas (APP), serviços vigiados (MONITOR), agentes (AGENT, pela chave) e projetos (PROJECT). Filtra por tipo ou por nome.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['SERVER', 'GUEST', 'APP', 'MONITOR', 'AGENT', 'PROJECT'],
          },
          query: {
            type: 'string',
            description: 'Parte do nome (ex.: "trek", "gmail").',
          },
        },
      },
      handler: async (input: { type?: DocLinkType; query?: string }) => {
        const needle = input.query?.trim().toLowerCase();
        const targets = (await context.docs.targets(context.userId)).filter(
          (target) =>
            target.type !== DocLinkType.DOC &&
            (!input.type || target.type === input.type) &&
            (!needle ||
              `${target.label} ${target.group}`.toLowerCase().includes(needle)),
        );
        if (!targets.length) return 'Nada a que ligar com esse filtro.';
        return targets
          .map(
            (target) =>
              `- ${target.type} · ${target.label} → targetId "${target.targetId}"`,
          )
          .join('\n');
      },
    },
    {
      name: 'docs_propose',
      description:
        'Propõe ao utilizador uma mudança num documento dele; só vale depois de ele aprovar (na tarefa ou em Documentos), e a versão anterior fica guardada. edit (o texto completo novo) é o normal: uma regra ou um ponto que faltou vai para o documento da app, na secção certa. append só para acrescentar uma secção no fim. create só quando não existe nenhum documento para aquilo. organize muda só a arrumação, sem tocar no texto: title (outro nome), add_links / remove_links, tags / add_tags / remove_tags e section. A arrumação também pode ir junto com edit, append ou create. Os ids das ligações vêm do docs_targets; onde cada documento aparece vem do docs_layout.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['edit', 'append', 'create', 'organize'],
          },
          doc: {
            type: 'string',
            description: 'O documento (edit/append/organize). Omite em create.',
          },
          title: {
            type: 'string',
            description:
              'create: o título. edit/organize: um título novo (para mudar o nome).',
          },
          kind: {
            type: 'string',
            enum: KINDS,
            description:
              'create: RULES (o que se pode fazer e como se faz — o normal numa proposta), MAP (o que existe) ou LOG.',
          },
          content: {
            type: 'string',
            description:
              'edit: o texto completo novo. append: só o que se acrescenta. create: o texto todo. organize: não se usa.',
          },
          reason: {
            type: 'string',
            description:
              'Porquê, numa ou duas frases (o utilizador lê isto ao decidir).',
          },
          task: {
            type: 'string',
            description:
              'A tarefa do quadro que levou a esta proposta (ex.: ATU-24), se houver. Fica lá um comentário com o link e a tarefa espera pela decisão.',
          },
          links: {
            ...LINKS,
            description: `create: as ligações do documento novo. ${LINKS.description}`,
          },
          add_links: {
            ...LINKS,
            description: `edit/append/organize: ligações a acrescentar (as que já tem ficam). ${LINKS.description}`,
          },
          remove_links: {
            type: 'array',
            items: { type: 'string' },
            description:
              'edit/append/organize: os targetId das ligações a tirar.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              'As etiquetas todas (substitui as que tem). Em create, as do documento novo. Minúsculas, sem acentos nem espaços (ex.: atualizacao, home-assistant).',
          },
          add_tags: { type: 'array', items: { type: 'string' } },
          remove_tags: { type: 'array', items: { type: 'string' } },
          section: {
            type: 'string',
            description:
              'A secção dele onde o documento passa a estar: o nome ou o id de uma que existe, um nome novo (cria-se ao aprovar), ou "" para sair das secções (volta ao automático).',
          },
          replaces: {
            type: 'array',
            items: { type: 'string' },
            description:
              'create: os ids dos documentos que o novo junta num só (ex.: o "estudar" e o "instalar" de uma app). Se ele aprovar, esses apagam-se: diz-lho no reason.',
          },
        },
        required: ['action', 'reason'],
      },
      handler: async (input: {
        action: 'edit' | 'append' | 'create' | 'organize';
        doc?: string;
        title?: string;
        kind?: DocKind;
        content?: string;
        reason: string;
        task?: string;
        links?: LinkInput;
        add_links?: LinkInput;
        remove_links?: string[];
        tags?: string[];
        add_tags?: string[];
        remove_tags?: string[];
        section?: string;
        replaces?: string[];
      }) => {
        if (input.action !== 'organize' && !input.content?.trim()) {
          return 'Falta o texto (content). Para mudar só o título, as ligações, as etiquetas ou a secção, usa action organize.';
        }
        let task: { id: string; key: string } | undefined;
        if (input.task?.trim()) {
          const found = await context.board.findForAgent(
            context.userId,
            input.task,
          );
          if (typeof found === 'string') return found;
          const { key } = await context.board.task(context.userId, found.id);
          task = { id: found.id, key };
        }

        const organize: ProposalOrganize = {};
        if (input.section !== undefined) {
          const name = input.section.trim();
          if (!name) {
            organize.section = { id: null };
          } else {
            const existing = await context.docs.findSection(
              context.userId,
              name,
            );
            organize.section = existing ? { id: existing.id } : { name };
          }
        }

        let docId: string | undefined;
        let title = input.title?.trim() ?? '';
        if (input.action !== 'create') {
          if (!input.doc) return 'Falta o documento (doc).';
          const doc = await context.docs.findForAgent(
            context.userId,
            input.doc,
          );
          if (typeof doc === 'string') return doc;
          docId = doc.id;
          title = doc.title;
          if (input.title?.trim() && input.title.trim() !== doc.title) {
            organize.title = input.title.trim();
          }
          if (input.add_links?.length || input.remove_links?.length) {
            organize.links = mergeLinks(
              doc.links.map(({ type, targetId, label }) => ({
                type,
                targetId,
                label,
              })),
              input.add_links,
              input.remove_links,
            );
          }
          if (
            input.tags ||
            input.add_tags?.length ||
            input.remove_tags?.length
          ) {
            const base = input.tags ?? doc.tags;
            const removed = new Set(input.remove_tags ?? []);
            organize.tags = [
              ...new Set([...base, ...(input.add_tags ?? [])]),
            ].filter((tag) => !removed.has(tag));
          }
          if (input.action === 'organize' && !Object.keys(organize).length) {
            return 'Não há nada a mudar: diz o title, add_links/remove_links, tags/add_tags/remove_tags ou section.';
          }
        } else if (!input.title?.trim()) {
          return 'Para propor um documento novo falta o título.';
        } else {
          // Um documento novo com o título de um que já existe é quase sempre um
          // duplicado (o agente não o viu): propõe-se a mudança nesse.
          const same = await context.docs.findForAgent(
            context.userId,
            input.title.trim(),
          );
          if (typeof same !== 'string') {
            return `Já existe "${same.title}" (${same.id}). Não cries outro: lê-o com docs_read e, se faltar alguma coisa, propõe uma mudança nele (edit, append ou organize).`;
          }
        }
        const inChat = context.source === 'chat' && context.conversationId;
        const proposal = await context.docs.propose(context.userId, {
          docId,
          action:
            input.action === 'edit'
              ? DocProposalAction.EDIT
              : input.action === 'append'
                ? DocProposalAction.APPEND
                : input.action === 'organize'
                  ? DocProposalAction.ORGANIZE
                  : DocProposalAction.CREATE,
          title: input.action === 'create' ? input.title : undefined,
          kind: input.kind,
          content: input.content ?? '',
          reason: input.reason,
          links: input.action === 'create' ? input.links : undefined,
          tags: input.action === 'create' ? input.tags : undefined,
          replaces: input.replaces,
          organize: Object.keys(organize).length ? organize : undefined,
          proposedBy: agentKey,
          task,
          chat: inChat
            ? {
                conversationId: context.conversationId!,
                turnId: context.turnId,
              }
            : undefined,
        });
        if (task) {
          await context.board.comment(
            context.userId,
            task.id,
            `📄 Propus uma mudança em «${title}»: ${input.reason}\n\nAprova, edita ou rejeita aqui na tarefa, no topo.`,
            agentKey,
          );
        }
        const where = inChat
          ? 'aqui no chat (aparece por baixo da resposta, com o botão Aprovar), na tarefa ou em Documentos; também pode dizer que aprova, e aí o Jarvis decide-a com docs_decide'
          : task
            ? 'na tarefa'
            : 'em Documentos';
        return `Proposta feita (id ${proposal.id}). O utilizador aprova ou recusa ${where} (diz-lho no relatório).`;
      },
    },
    {
      name: 'docs_decide',
      description:
        'Aprova ou recusa uma proposta de documento (feita com docs_propose) quando ele to diz no chat ("aprovo", "pode gravar", "recusa"). Só com a decisão dele na mensagem a que estás a responder: nunca por iniciativa tua nem na resposta em que a propuseste. Aprova o texto tal como foi proposto; se ele quiser mudar alguma coisa, recusa esta e faz uma proposta nova. Sem proposal, decide a única por decidir nesta conversa.',
      inputSchema: {
        type: 'object',
        properties: {
          proposal: {
            type: 'string',
            description:
              'O id da proposta (vem no resultado do docs_propose). Omite se só houver uma por decidir nesta conversa.',
          },
          decision: { type: 'string', enum: ['approve', 'reject'] },
        },
        required: ['decision'],
      },
      handler: async (input: {
        proposal?: string;
        decision: 'approve' | 'reject';
      }) => {
        if (context.source !== 'chat') {
          return 'Uma proposta só se decide no chat, quando ele o diz. Deixa-a para ele aprovar.';
        }
        const pending = await context.docs.proposals(context.userId);
        const labelOf = (item: (typeof pending)[number]) =>
          item.doc?.title ?? item.title ?? 'Documento novo';
        const wanted = input.proposal?.trim();
        let proposal = wanted
          ? pending.find((item) => item.id === wanted)
          : undefined;
        if (wanted && !proposal) {
          return 'Não há nenhuma proposta por decidir com esse id (já pode ter sido decidida).';
        }
        if (!proposal) {
          const here = pending.filter(
            (item) =>
              context.conversationId &&
              item.conversationId === context.conversationId,
          );
          if (here.length !== 1) {
            return here.length
              ? `Há ${here.length} propostas por decidir nesta conversa; diz qual (proposal):\n${here.map((item) => `- ${item.id} · «${labelOf(item)}»: ${item.reason ?? ''}`).join('\n')}`
              : 'Não há nenhuma proposta por decidir nesta conversa. Se for outra, diz o id (proposal).';
          }
          proposal = here[0];
        }
        // Só uma proposta desta conversa, feita numa volta anterior, e no agente de topo:
        // as de um disparo ou de outra conversa decidem-se em Documentos ou na tarefa.
        const blocked = chatDecisionBlock(
          {
            status: 'PENDING',
            conversationId: proposal.conversationId,
            turnId: proposal.turnId,
          },
          context,
        );
        if (blocked) return blocked;
        const label = labelOf(proposal);
        if (input.decision === 'reject') {
          await context.docs.reject(context.userId, proposal.id);
          return `Recusada: «${label}». O documento ficou como estava.`;
        }
        try {
          const doc = await context.docs.approve(context.userId, proposal.id);
          return `Aprovada: «${doc.title}» já está gravado (a versão anterior fica no histórico).`;
        } catch (error) {
          return `Não aprovei «${label}»: ${error instanceof Error ? error.message : 'erro desconhecido'}`;
        }
      },
    },
  ];
}
