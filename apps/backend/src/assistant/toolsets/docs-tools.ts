import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  DocKind,
  DocLinkType,
  DocOwner,
  DocProposalAction,
} from 'src/generated/prisma/client/client';
import { describeDoc } from 'src/docs/docs.service';

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
        return (
          `${describeDoc(doc)}\n` +
          `Dono: ${doc.owner === DocOwner.USER ? 'o utilizador (não escreves; propões com docs_propose)' : 'os agentes (podes reescrever com docs_write)'}. ` +
          `Atualizado a ${doc.updatedAt.toISOString().slice(0, 16).replace('T', ' ')} por ${doc.updatedBy ?? '—'}.\n\n` +
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
        if (input.doc) {
          const doc = await context.docs.findForAgent(
            context.userId,
            input.doc,
          );
          if (typeof doc === 'string') return doc;
          if (doc.owner !== DocOwner.AGENT) {
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
      name: 'docs_propose',
      description:
        'Propõe ao utilizador uma versão nova de um documento dele; só vale depois de ele aprovar (na tarefa ou em Documentos), e a versão anterior fica guardada. edit (o texto completo novo) é o normal: uma regra ou um ponto que faltou vai para o documento da app, na secção certa ("Antes de instalar", "Depois de instalar", "Onde corre"…). append só para acrescentar uma secção no fim. create só quando não existe nenhum documento para aquilo (ex.: uma app nova); documentos de aprendizagens não se criam.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['edit', 'append', 'create'] },
          doc: {
            type: 'string',
            description: 'O documento (edit/append). Omite em create.',
          },
          title: { type: 'string', description: 'create: o título.' },
          kind: {
            type: 'string',
            enum: KINDS,
            description:
              'create: RULES (o que se pode fazer e como se faz — o normal numa proposta), MAP (o que existe) ou LOG.',
          },
          content: {
            type: 'string',
            description:
              'edit: o texto completo novo. append: só o que se acrescenta. create: o texto todo.',
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
          links: LINKS,
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              'create: as etiquetas do documento novo (é por elas e pelas ligações que os agentes sabem quando o ler).',
          },
          replaces: {
            type: 'array',
            items: { type: 'string' },
            description:
              'create: os ids dos documentos que o novo junta num só (ex.: o "estudar" e o "instalar" de uma app). Se ele aprovar, esses apagam-se: diz-lho no reason.',
          },
        },
        required: ['action', 'content', 'reason'],
      },
      handler: async (input: {
        action: 'edit' | 'append' | 'create';
        doc?: string;
        title?: string;
        kind?: DocKind;
        content: string;
        reason: string;
        task?: string;
        links?: LinkInput;
        tags?: string[];
        replaces?: string[];
      }) => {
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
        let docId: string | undefined;
        let title = input.title?.trim() ?? '';
        if (input.action !== 'create') {
          if (!input.doc) return 'Falta o documento (doc) para edit/append.';
          const doc = await context.docs.findForAgent(
            context.userId,
            input.doc,
          );
          if (typeof doc === 'string') return doc;
          docId = doc.id;
          title = doc.title;
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
            return `Já existe "${same.title}" (${same.id}). Não cries outro: lê-o com docs_read e, se faltar alguma coisa, propõe uma mudança nele (edit ou append).`;
          }
        }
        await context.docs.propose(context.userId, {
          docId,
          action:
            input.action === 'edit'
              ? DocProposalAction.EDIT
              : input.action === 'append'
                ? DocProposalAction.APPEND
                : DocProposalAction.CREATE,
          title: input.title,
          kind: input.kind,
          content: input.content,
          reason: input.reason,
          links: input.links,
          tags: input.tags,
          replaces: input.replaces,
          proposedBy: agentKey,
          task,
        });
        if (task) {
          await context.board.comment(
            context.userId,
            task.id,
            `📄 Propus uma mudança em «${title}»: ${input.reason}\n\nAprova, edita ou rejeita aqui na tarefa, no topo.`,
            agentKey,
          );
        }
        return task
          ? 'Proposta feita. O utilizador aprova ou recusa na tarefa (diz-lho no relatório).'
          : 'Proposta feita. O utilizador aprova ou recusa em Documentos (diz-lho no relatório).';
      },
    },
  ];
}
