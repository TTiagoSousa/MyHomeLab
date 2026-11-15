import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectionProvider,
  Doc,
  DocKind,
  DocLink,
  DocLinkType,
  DocOwner,
  DocProposalAction,
  DocProposalStatus,
  NotificationKind,
  Prisma,
} from 'src/generated/prisma/client/client';
import { NotificationService } from 'src/notification/notification.service';
import {
  createProxmoxClient,
  ProxmoxGuestRef,
} from 'src/proxmox/proxmox.client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import {
  CreateDocDto,
  DocLinkDto,
  ListDocsQueryDto,
  UpdateDocDto,
} from './dto/doc.dto';
import {
  linkNeedles,
  mentions,
  normalizeText,
  searchWords,
  snippet,
} from './helpers/docText';
import { starterDocs } from './helpers/starterDocs';
import {
  proposalNoticeSubject,
  proposalTodoSubject,
} from './helpers/proposalTodo';
import { TodoService } from 'src/todo/todo.service';
import { updatesAgentKey } from 'src/agent/helpers/updatesAgentKey';

/** Quantas versões anteriores ficam de cada documento. */
const KEEP_VERSIONS = 30;

/** O índice que os agentes leem não passa disto (o resto procura-se com docs_search). */
const INDEX_LIMIT = 120;

export const PROVIDER_NAMES: Record<ConnectionProvider, string> = {
  GMAIL: 'Gmail',
  OUTLOOK: 'Outlook',
  IMAP: 'Email (IMAP)',
  NEXTCLOUD: 'Nextcloud',
  FORGEJO: 'Forgejo',
  TREK: 'TREK',
  HOME_ASSISTANT: 'Home Assistant',
  ADGUARD: 'AdGuard',
  GOOGLE_TASKS: 'Google Tasks',
  OPENGYM: 'openGym',
};

/** O nome de uma app ligada como aparece nas ligações: "Home Assistant · Casa" (sem repetir "Forgejo · Forgejo"). */
export const appLabel = (account: {
  provider: ConnectionProvider;
  displayName: string | null;
}) => {
  const app = PROVIDER_NAMES[account.provider];
  const name = account.displayName?.trim();
  return name && name.toLowerCase() !== app.toLowerCase()
    ? `${app} · ${name}`
    : app;
};

/** O id de uma máquina nas ligações: o servidor e o vmid. */
export const guestTargetId = (serverId: string, vmid: number) =>
  `${serverId}:${vmid}`;

export type DocWithLinks = Doc & { links: DocLink[] };

export interface DocTarget {
  type: DocLinkType;
  targetId: string;
  label: string;
  group: string; // o servidor de uma máquina, o tipo de uma app…
}

export interface DocWrite {
  title?: string;
  kind?: DocKind;
  content?: string;
  summary?: string | null;
  tags?: string[];
  required?: boolean;
  links?: DocLinkDto[];
}

/** Quem é avisado quando um documento (não registo) muda ou é apagado. */
export type DocChangeListener = (
  userId: string,
  doc: Pick<Doc, 'id' | 'title' | 'kind' | 'required'>,
) => Promise<void>;

/** Quem escreve: o utilizador (no site) ou um agente (pela chave). */
export type DocAuthor = { kind: 'user' } | { kind: 'agent'; key: string };

const authorName = (author: DocAuthor) =>
  author.kind === 'user' ? 'user' : author.key;

const cleanTags = (tags: string[] | undefined) =>
  tags
    ? [
        ...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
      ].slice(0, 20)
    : undefined;

const uniqueLinks = (links: DocLinkDto[]) => [
  ...new Map(
    links.map((link) => [`${link.type}:${link.targetId}`, link]),
  ).values(),
];

/**
 * Os documentos do utilizador: regras, checklists, notas, aprendizagens e os guias
 * dos servidores. Ligam-se a qualquer coisa (servidores, máquinas, apps, serviços,
 * agentes, outros documentos). Os agentes leem o índice, os obrigatórios do que o
 * pedido toca e procuram o resto; nos documentos do utilizador só propõem mudanças.
 */
/**
 * As ligações cujo nome puxa um documento obrigatório quando o pedido o menciona:
 * as coisas (uma app, um servidor, uma máquina, um monitor). As ligações a outros
 * documentos, a agentes e a projetos não: o título de um guia geral ou o nome de
 * um agente puxavam documentos que nada tinham a ver com o pedido.
 */
const MATCHED_LINKS = new Set<DocLinkType>([
  DocLinkType.APP,
  DocLinkType.SERVER,
  DocLinkType.GUEST,
  DocLinkType.MONITOR,
]);

@Injectable()
export class DocsService {
  private readonly changeListeners: DocChangeListener[] = [];
  constructor(
    private readonly prisma: PrismaService,
    private readonly todos: TodoService,
    private readonly notifications: NotificationService,
  ) {}

  /** As atualizações ouvem isto: regras novas invalidam o que foi preparado com as antigas. */
  onChange(listener: DocChangeListener) {
    this.changeListeners.push(listener);
  }

  private changed(userId: string, doc: DocWithLinks | Doc) {
    if (doc.kind === DocKind.LOG) return;
    for (const listener of this.changeListeners) {
      void listener(userId, doc).catch(() => undefined);
    }
  }

  // ── Ler ─────────────────────────────────────────────────────────────────

  async list(userId: string, query: ListDocsQueryDto = {}) {
    const words = searchWords(query.search);
    const where: Prisma.DocWhereInput = {
      userId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.typeId ? { typeId: query.typeId } : {}),
      ...(query.required ? { required: true } : {}),
      ...(query.owner ? { owner: query.owner } : {}),
      ...(query.linkType
        ? {
            links: {
              some: {
                type: query.linkType,
                ...(query.targetId ? { targetId: query.targetId } : {}),
              },
            },
          }
        : {}),
      AND: words.map((word) => ({
        OR: [
          { title: { contains: word, mode: 'insensitive' } },
          { content: { contains: word, mode: 'insensitive' } },
          { summary: { contains: word, mode: 'insensitive' } },
          { tags: { has: word.toLowerCase() } },
          {
            links: { some: { label: { contains: word, mode: 'insensitive' } } },
          },
        ],
      })),
    };
    const docs = await this.prisma.doc.findMany({
      where,
      include: { links: true },
      orderBy:
        query.sort === 'title' ? { title: 'asc' } : { updatedAt: 'desc' },
      take: 300,
    });
    return docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      typeId: doc.typeId,
      owner: doc.owner,
      required: doc.required,
      tags: doc.tags,
      summary: doc.summary,
      links: doc.links,
      snippet: snippet(doc.content, words),
      updatedBy: doc.updatedBy,
      updatedAt: doc.updatedAt,
    }));
  }

  async get(userId: string, id: string) {
    const doc = await this.findOwned(userId, id);
    const versions = await this.prisma.docVersion.findMany({
      where: { docId: id },
      select: { id: true, title: true, editedBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...doc, versions };
  }

  /** Os documentos ligados a uma coisa (a secção "Documentos" de cada página). */
  linked(userId: string, type: DocLinkType, targetId: string) {
    return this.prisma.doc.findMany({
      where: { userId, links: { some: { type, targetId } } },
      include: { links: true },
      orderBy: [{ required: 'desc' }, { title: 'asc' }],
    });
  }

  async version(userId: string, id: string, versionId: string) {
    await this.findOwned(userId, id);
    const version = await this.prisma.docVersion.findFirst({
      where: { id: versionId, docId: id },
    });
    if (!version) throw new NotFoundException('Versão não encontrada');
    return version;
  }

  // ── Tipos (os que ele cria) ─────────────────────────────────────────────

  listTypes(userId: string) {
    return this.prisma.docType.findMany({
      where: { userId },
      include: { _count: { select: { docs: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createType(userId: string, name: string) {
    const clean = name.trim().replace(/\s+/g, ' ');
    const existing = await this.prisma.docType.findFirst({
      where: { userId, name: { equals: clean, mode: 'insensitive' } },
    });
    if (existing)
      throw new BadRequestException(`Já há o tipo "${existing.name}".`);
    return this.prisma.docType.create({ data: { userId, name: clean } });
  }

  /** Apagar um tipo: os documentos dele ficam como "Outro". */
  async deleteType(userId: string, id: string) {
    const type = await this.prisma.docType.findFirst({ where: { id, userId } });
    if (!type) throw new NotFoundException('Esse tipo já não existe.');
    await this.prisma.docType.delete({ where: { id } });
  }

  /** O tipo escolhido tem de ser dele; null tira-o. */
  private async ownType(userId: string, typeId: string | null | undefined) {
    if (!typeId) return null;
    const type = await this.prisma.docType.findFirst({
      where: { id: typeId, userId },
      select: { id: true },
    });
    if (!type) throw new BadRequestException('Esse tipo já não existe.');
    return type.id;
  }

  // ── Escrever ────────────────────────────────────────────────────────────

  async create(userId: string, input: CreateDocDto, author: DocAuthor) {
    const typeId = await this.ownType(userId, input.typeId);
    return this.prisma.doc.create({
      data: {
        userId,
        title: input.title.trim(),
        kind: typeId ? DocKind.OTHER : (input.kind ?? DocKind.NOTES),
        typeId,
        owner: author.kind === 'user' ? DocOwner.USER : DocOwner.AGENT,
        content: input.content ?? '',
        summary: input.summary?.trim() || null,
        tags: cleanTags(input.tags) ?? [],
        required: input.required ?? false,
        updatedBy: authorName(author),
        links: { create: uniqueLinks(input.links ?? []) },
      },
      include: { links: true },
    });
  }

  /**
   * Muda um documento. A versão anterior fica guardada (as últimas 30). Um agente
   * só escreve nos documentos dele; nos do utilizador propõe (`propose`).
   */
  async update(
    userId: string,
    id: string,
    input: UpdateDocDto,
    author: DocAuthor,
  ) {
    const doc = await this.findOwned(userId, id);
    if (author.kind === 'agent' && doc.owner !== DocOwner.AGENT) {
      throw new BadRequestException(
        `"${doc.title}" é um documento do utilizador: propõe a mudança com docs_propose.`,
      );
    }
    const title = input.title?.trim() ?? doc.title;
    const content = input.content ?? doc.content;
    const textChanged = title !== doc.title || content !== doc.content;
    if (textChanged) {
      await this.saveVersion(doc);
    }
    const typeId =
      input.typeId === undefined
        ? undefined
        : await this.ownType(userId, input.typeId);
    const saved = await this.prisma.doc.update({
      where: { id },
      data: {
        title,
        content,
        kind: typeId ? DocKind.OTHER : input.kind,
        typeId,
        summary:
          input.summary === undefined
            ? undefined
            : input.summary?.trim() || null,
        tags: cleanTags(input.tags),
        required: input.required,
        updatedBy: authorName(author),
        ...(input.links
          ? {
              links: {
                deleteMany: {},
                create: uniqueLinks(input.links),
              },
            }
          : {}),
      },
      include: { links: true },
    });
    if (textChanged || input.links || input.required !== undefined) {
      this.changed(userId, saved);
    }
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOwned(userId, id);
    // As propostas apagam-se com o documento: os avisos e as tarefas delas fecham antes.
    const pending = await this.prisma.docProposal.findMany({
      where: { docId: id, status: DocProposalStatus.PENDING },
      select: { id: true },
    });
    await this.prisma.doc.delete({ where: { id } });
    for (const proposal of pending)
      await this.closeProposalTodo(
        proposal.id,
        userId,
        'O documento foi apagado.',
      );
    this.changed(userId, doc);
  }

  /** Volta a uma versão anterior (a atual fica também nas versões). */
  async restore(userId: string, id: string, versionId: string) {
    const version = await this.version(userId, id, versionId);
    return this.update(
      userId,
      id,
      { title: version.title, content: version.content },
      { kind: 'user' },
    );
  }

  // ── Propostas dos agentes ───────────────────────────────────────────────

  proposals(userId: string) {
    return this.prisma.docProposal.findMany({
      where: { userId, status: DocProposalStatus.PENDING },
      include: { doc: { select: { id: true, title: true, content: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async propose(
    userId: string,
    input: {
      docId?: string;
      action: DocProposalAction;
      title?: string;
      kind?: DocKind;
      content: string;
      reason?: string;
      links?: DocLinkDto[];
      proposedBy: string;
      /** A tarefa do quadro de onde veio: a proposta aparece lá, e o aviso "Aprovar: …" leva até ela. */
      task?: { id: string; key: string };
    },
  ) {
    const doc = input.docId ? await this.findOwned(userId, input.docId) : null;
    const proposal = await this.prisma.docProposal.create({
      data: {
        userId,
        docId: input.docId ?? null,
        action: input.action,
        title: input.title?.trim() || null,
        kind: input.kind ?? null,
        content: input.content,
        reason: input.reason?.trim() || null,
        links: input.links
          ? (uniqueLinks(input.links) as unknown as Prisma.InputJsonValue)
          : undefined,
        proposedBy: input.proposedBy,
        taskId: input.task?.id ?? null,
      },
    });
    // Vai para as Notificações ("Precisa de ti"); abre a tarefa de onde veio, onde se decide.
    await this.notifications
      .openUserSubject({
        userId,
        subject: proposalNoticeSubject(proposal.id, input.task?.id),
        kind: NotificationKind.AGENT_NOTICE,
        title: `Aprovar: «${doc?.title ?? proposal.title ?? 'Documento novo'}»${input.task ? ` (${input.task.key})` : ''}`,
        message: proposal.reason ?? `${input.proposedBy} propõe uma mudança.`,
      })
      .catch(() => undefined);
    return proposal;
  }

  /** Decidida a proposta, o aviso fecha (e a tarefa "Aprovar: …" das propostas antigas fica feita). */
  private async closeProposalTodo(
    proposalId: string,
    userId: string,
    note: string,
  ) {
    await this.notifications
      .resolveUserSubjectsExcept(
        userId,
        proposalNoticeSubject(proposalId),
        '',
        NotificationKind.AGENT_NOTICE,
      )
      .catch(() => undefined);
    await this.todos
      .closeSubject(userId, proposalTodoSubject(proposalId), note)
      .catch(() => undefined);
  }

  async approve(userId: string, proposalId: string, content?: string) {
    const proposal = await this.findProposal(userId, proposalId);
    const text = content ?? proposal.content;
    let doc: DocWithLinks;
    if (proposal.action === DocProposalAction.CREATE || !proposal.docId) {
      doc = await this.create(
        userId,
        {
          title: proposal.title ?? 'Documento novo',
          kind: proposal.kind ?? DocKind.NOTES,
          content: text,
          links: (proposal.links as unknown as DocLinkDto[] | null) ?? [],
        },
        { kind: 'user' },
      );
    } else {
      const current = await this.findOwned(userId, proposal.docId);
      // Uma proposta que substitui tudo, feita sobre uma versão mais antiga, apagava o que
      // mudou depois: só se aprova com o texto revisto (ou rejeita-se).
      if (
        proposal.action !== DocProposalAction.APPEND &&
        content === undefined &&
        current.updatedAt > proposal.createdAt
      ) {
        throw new BadRequestException(
          'O documento mudou depois desta proposta: aprová-la como está apagava essas mudanças. Edita o texto da proposta (junta as duas) antes de aprovar, ou rejeita-a.',
        );
      }
      doc = await this.update(
        userId,
        current.id,
        {
          content:
            proposal.action === DocProposalAction.APPEND
              ? `${current.content.trimEnd()}\n${text.trim()}\n`
              : text,
        },
        { kind: 'user' },
      );
      await this.prisma.doc.update({
        where: { id: current.id },
        data: { updatedBy: `${proposal.proposedBy} (aprovado)` },
      });
    }
    await this.prisma.docProposal.update({
      where: { id: proposal.id },
      data: { status: DocProposalStatus.APPROVED, decidedAt: new Date() },
    });
    await this.closeProposalTodo(
      proposal.id,
      userId,
      content ? 'Aprovada com alterações.' : 'Aprovada.',
    );
    return doc;
  }

  async reject(userId: string, proposalId: string): Promise<void> {
    const proposal = await this.findProposal(userId, proposalId);
    await this.prisma.docProposal.update({
      where: { id: proposal.id },
      data: { status: DocProposalStatus.REJECTED, decidedAt: new Date() },
    });
    await this.closeProposalTodo(proposal.id, userId, 'Rejeitada.');
  }

  // ── A que se pode ligar ─────────────────────────────────────────────────

  /**
   * Tudo a que um documento se pode ligar: servidores e as máquinas deles (lidas do
   * Proxmox; um servidor que não responda fica só com o nome), apps ligadas,
   * serviços vigiados, agentes e outros documentos.
   */
  async targets(userId: string): Promise<DocTarget[]> {
    const [servers, accounts, monitors, agents, docs, projects] =
      await Promise.all([
        this.prisma.serverConnection.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.connectedAccount.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.serviceMonitor.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.agent.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.doc.findMany({
          where: { userId },
          select: { id: true, title: true, kind: true },
          orderBy: { title: 'asc' },
        }),
        this.prisma.project.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
      ]);

    const targets: DocTarget[] = [];
    for (const server of servers) {
      targets.push({
        type: DocLinkType.SERVER,
        targetId: server.id,
        label: server.name,
        group: server.name,
      });
      const guests = await createProxmoxClient(toProxmoxConnection(server))
        .listGuests()
        .catch((): ProxmoxGuestRef[] => []);
      for (const ref of guests.sort((a, b) => a.guest.vmid - b.guest.vmid)) {
        targets.push({
          type: DocLinkType.GUEST,
          targetId: guestTargetId(server.id, ref.guest.vmid),
          label:
            `${ref.kind === 'qemu' ? 'VM' : 'CT'} ${ref.guest.vmid} ${ref.guest.name ?? ''}`.trim(),
          group: server.name,
        });
      }
    }
    for (const account of accounts) {
      targets.push({
        type: DocLinkType.APP,
        targetId: account.id,
        // Com várias contas da mesma app (vários Gmail), o email distingue-as.
        label:
          !account.displayName?.trim() && account.emailAddress
            ? `${PROVIDER_NAMES[account.provider]} · ${account.emailAddress}`
            : appLabel(account),
        group: PROVIDER_NAMES[account.provider],
      });
    }
    for (const monitor of monitors) {
      targets.push({
        type: DocLinkType.MONITOR,
        targetId: monitor.id,
        label: monitor.name,
        group: monitor.kind,
      });
    }
    for (const agent of agents) {
      targets.push({
        type: DocLinkType.AGENT,
        targetId: agent.key,
        label: agent.name,
        group: 'agent',
      });
    }
    for (const project of projects) {
      targets.push({
        type: DocLinkType.PROJECT,
        targetId: project.id,
        label: project.name,
        group: 'project',
      });
    }
    for (const doc of docs) {
      targets.push({
        type: DocLinkType.DOC,
        targetId: doc.id,
        label: doc.title,
        group: doc.kind,
      });
    }
    return targets;
  }

  // ── Para os agentes ─────────────────────────────────────────────────────

  /**
   * O que vai nas instruções de um agente: o índice (uma linha por documento) e o
   * texto inteiro dos obrigatórios gerais (sem ligações), dos ligados a ele e dos
   * ligados aos projetos em que trabalha. Só muda quando os documentos mudam, por
   * isso não estraga a cache entre conversas.
   */
  async agentContext(
    userId: string,
    agentKey?: string,
  ): Promise<{
    index: string[];
    general: { title: string; content: string }[];
  }> {
    const [docs, projects] = await Promise.all([
      this.prisma.doc.findMany({
        where: { userId, kind: { not: DocKind.LOG } },
        include: { links: true },
        orderBy: [{ required: 'desc' }, { title: 'asc' }],
        take: INDEX_LIMIT,
      }),
      agentKey
        ? this.prisma.project.findMany({
            where: { userId, agentKeys: { has: agentKey } },
            select: { id: true },
          })
        : Promise.resolve([] as { id: string }[]),
    ]);
    const myProjects = new Set(projects.map((project) => project.id));
    return {
      index: docs.map(describeDoc),
      general: docs
        .filter(
          (doc) =>
            doc.required &&
            doc.content.trim() &&
            (!doc.links.length ||
              doc.links.some(
                (link) =>
                  (link.type === DocLinkType.AGENT &&
                    link.targetId === agentKey) ||
                  (link.type === DocLinkType.PROJECT &&
                    myProjects.has(link.targetId)),
              )),
        )
        .map((doc) => ({ title: doc.title, content: doc.content.trim() })),
    };
  }

  /** Os obrigatórios ligados a algo que o texto do pedido menciona. */
  async requiredFor(
    userId: string,
    text: string,
    agentKey?: string,
  ): Promise<DocWithLinks[]> {
    const haystack = normalizeText(text);
    const docs = await this.prisma.doc.findMany({
      where: { userId, required: true, links: { some: {} } },
      include: { links: true },
      orderBy: { title: 'asc' },
    });
    return docs.filter(
      (doc) =>
        // Os do próprio agente já vão nas instruções dele.
        !doc.links.some(
          (link) =>
            link.type === DocLinkType.AGENT && link.targetId === agentKey,
        ) &&
        [
          ...doc.links
            .filter((link) => MATCHED_LINKS.has(link.type))
            .flatMap((link) => linkNeedles(link.label)),
          ...doc.tags.filter((tag) => tag.length >= 4).map(normalizeText),
        ]
          .filter((needle) => !GENERIC_TAGS.has(needle))
          .some((needle) => mentions(haystack, needle)),
    );
  }

  /** Os documentos ligados a qualquer das coisas indicadas (as regras de uma atualização). */
  linkedToAny(
    userId: string,
    targets: { type: DocLinkType; targetId: string }[],
    onlyRequired = false,
  ): Promise<DocWithLinks[]> {
    return this.prisma.doc.findMany({
      where: {
        userId,
        ...(onlyRequired ? { required: true } : {}),
        links: { some: { OR: targets } },
      },
      include: { links: true },
      orderBy: { title: 'asc' },
    });
  }

  /** A chave do agente que trata das atualizações (o que tem update_save_study). */
  updatesAgentKey(userId: string): Promise<string> {
    return updatesAgentKey(this.prisma, userId);
  }

  /** Os obrigatórios gerais (sem ligações). */
  requiredGeneral(userId: string): Promise<DocWithLinks[]> {
    return this.prisma.doc.findMany({
      where: { userId, required: true, links: { none: {} } },
      include: { links: true },
      orderBy: { title: 'asc' },
    });
  }

  /** Um documento pelo id ou pelo título (exato, ou a única parecença). */
  async findForAgent(
    userId: string,
    ref: string,
  ): Promise<DocWithLinks | string> {
    const needle = ref.trim();
    const byId = await this.prisma.doc.findFirst({
      where: { userId, id: needle },
      include: { links: true },
    });
    if (byId) return byId;
    const matches = await this.prisma.doc.findMany({
      where: { userId, title: { contains: needle, mode: 'insensitive' } },
      include: { links: true },
      take: 10,
    });
    const exact = matches.filter(
      (doc) => normalizeText(doc.title) === normalizeText(needle),
    );
    if (exact.length === 1) return exact[0];
    if (matches.length === 1) return matches[0];
    if (!matches.length) {
      return `Não há nenhum documento "${ref}". Procura com docs_search.`;
    }
    return `"${ref}" pode ser: ${matches.map((doc) => `"${doc.title}" (${doc.id})`).join(', ')}. Usa o id.`;
  }

  // ── Registos ────────────────────────────────────────────────────────────
  // O que os agentes fizeram (atualizações, comandos aprovados…). São deles e
  // mudam muitas vezes, por isso não guardam versões: o histórico vai no texto.

  /** Escreve o registo inteiro: o com este id (se ainda existir) ou um novo. */
  async writeLog(
    userId: string,
    docId: string | null,
    input: {
      title: string;
      content: string;
      summary?: string;
      tags?: string[];
      links?: DocLinkDto[];
    },
    author: DocAuthor,
  ): Promise<DocWithLinks> {
    const current = docId
      ? await this.prisma.doc.findFirst({ where: { id: docId, userId } })
      : null;
    if (current) {
      return this.prisma.doc.update({
        where: { id: current.id },
        data: {
          title: input.title.trim(),
          content: input.content,
          summary: input.summary?.trim() || current.summary,
          updatedBy: authorName(author),
          ...(input.links
            ? {
                links: {
                  deleteMany: {},
                  create: uniqueLinks(input.links),
                },
              }
            : {}),
        },
        include: { links: true },
      });
    }
    return this.createLog(userId, input, author);
  }

  /** Acrescenta uma entrada ao registo com este título (cria-o se ainda não houver). */
  async appendLog(
    userId: string,
    input: {
      title: string;
      entry: string;
      summary?: string;
      tags?: string[];
      links?: DocLinkDto[];
    },
    author: DocAuthor,
  ): Promise<DocWithLinks> {
    const entry = `### ${lisbonTime(new Date())} — ${authorName(author)}

${input.entry.trim()}
`;
    const current = await this.prisma.doc.findFirst({
      where: {
        userId,
        kind: DocKind.LOG,
        title: { equals: input.title.trim(), mode: 'insensitive' },
      },
      include: { links: true },
    });
    if (!current) {
      return this.createLog(
        userId,
        {
          ...input,
          content: `# ${input.title.trim()}

${entry}`,
        },
        author,
      );
    }
    const known = new Set(
      current.links.map((link) => `${link.type}:${link.targetId}`),
    );
    const extra = uniqueLinks(input.links ?? []).filter(
      (link) => !known.has(`${link.type}:${link.targetId}`),
    );
    return this.prisma.doc.update({
      where: { id: current.id },
      data: {
        content: `${current.content.trimEnd()}

${entry}`,
        updatedBy: authorName(author),
        ...(extra.length ? { links: { create: extra } } : {}),
      },
      include: { links: true },
    });
  }

  private async createLog(
    userId: string,
    input: {
      title: string;
      content: string;
      summary?: string;
      tags?: string[];
      links?: DocLinkDto[];
    },
    author: DocAuthor,
  ) {
    const doc = await this.create(
      userId,
      {
        title: input.title,
        kind: DocKind.LOG,
        content: input.content,
        summary: input.summary,
        tags: ['registo', ...(input.tags ?? [])],
        links: input.links,
      },
      author,
    );
    if (doc.owner === DocOwner.AGENT) return doc;
    return this.prisma.doc.update({
      where: { id: doc.id },
      data: { owner: DocOwner.AGENT },
      include: { links: true },
    });
  }

  // ── Documentos sugeridos ────────────────────────────────────────────────

  /** Cria os documentos sugeridos que ainda não existem (pelo título). */
  async createStarter(userId: string) {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { userId },
    });
    const existing = new Set(
      (
        await this.prisma.doc.findMany({
          where: { userId },
          select: { title: true },
        })
      ).map((doc) => normalizeText(doc.title)),
    );
    const created: DocWithLinks[] = [];
    for (const starter of starterDocs(
      accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        label: appLabel(account),
      })),
    )) {
      if (existing.has(normalizeText(starter.title))) continue;
      created.push(await this.create(userId, starter, { kind: 'user' }));
    }
    return created;
  }

  // ── Interno ─────────────────────────────────────────────────────────────

  private async saveVersion(doc: Doc) {
    await this.prisma.docVersion.create({
      data: {
        docId: doc.id,
        title: doc.title,
        content: doc.content,
        editedBy: doc.updatedBy ?? 'user',
      },
    });
    const old = await this.prisma.docVersion.findMany({
      where: { docId: doc.id },
      orderBy: { createdAt: 'desc' },
      skip: KEEP_VERSIONS,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.docVersion.deleteMany({
        where: { id: { in: old.map((row) => row.id) } },
      });
    }
  }

  private async findOwned(userId: string, id: string): Promise<DocWithLinks> {
    const doc = await this.prisma.doc.findFirst({
      where: { id, userId },
      include: { links: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  private async findProposal(userId: string, id: string) {
    const proposal = await this.prisma.docProposal.findFirst({
      where: { id, userId, status: DocProposalStatus.PENDING },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    return proposal;
  }
}

/** Etiquetas que estão em quase todos os documentos e não dizem a que se referem. */
const GENERIC_TAGS = new Set([
  'regras',
  'checklist',
  'notas',
  'atualizacoes',
  'servidor',
  'registo',
]);

/** "31/10/2026, 14:10" na hora de Lisboa. */
export const lisbonTime = (date: Date) =>
  date.toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'short',
    timeStyle: 'short',
  });

const KIND_NAMES: Record<DocKind, string> = {
  RULES: 'regras',
  CHECKLIST: 'checklist',
  NOTES: 'notas',
  LEARNINGS: 'aprendizagens',
  GUIDE: 'guia',
  LOG: 'registo',
  OTHER: 'outro',
};

/** Uma linha do índice: "[regras · obrigatório] Home Assistant – regras (id) → App Home Assistant — resumo". */
export function describeDoc(
  doc: Pick<
    DocWithLinks,
    'id' | 'title' | 'kind' | 'required' | 'links' | 'tags' | 'summary'
  >,
): string {
  const flags = [KIND_NAMES[doc.kind], doc.required ? 'obrigatório' : null]
    .filter(Boolean)
    .join(' · ');
  const links = doc.links.length
    ? ` → ${doc.links.map((link) => link.label).join(', ')}`
    : ' → geral';
  const tags = doc.tags.length ? ` #${doc.tags.join(' #')}` : '';
  return `[${flags}] ${doc.title} (${doc.id})${links}${tags}${doc.summary ? ` — ${doc.summary}` : ''}`;
}
