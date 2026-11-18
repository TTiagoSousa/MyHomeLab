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
import { listTemplateSets, loadTemplateSet } from './helpers/docTemplates';
import {
  proposalNoticeSubject,
  proposalTodoSubject,
} from './helpers/proposalTodo';
import { TodoService } from 'src/todo/todo.service';
import { updatesAgentKey } from 'src/agent/helpers/updatesAgentKey';
import { docAutoGroup } from '@myhomelab/shared';
import {
  ProposalOrganize,
  proposalChanges,
  readOrganize,
} from './helpers/proposalOrganize';

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
  GAMETRACKER: 'GamesTracker',
  IMMICH: 'Immich',
  PAPERLESS: 'Paperless',
  SOLIDTIME: 'solidtime',
  STIRLING_PDF: 'Stirling-PDF',
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

/**
 * O nome de uma conta nas ligações e nos grupos dos Documentos. Sem nome próprio, o
 * email distingue as contas da mesma app (vários Gmail): "Gmail · eu@gmail.com".
 */
export const accountLinkLabel = (account: {
  provider: ConnectionProvider;
  displayName: string | null;
  emailAddress: string | null;
}) =>
  !account.displayName?.trim() && account.emailAddress
    ? `${PROVIDER_NAMES[account.provider]} · ${account.emailAddress}`
    : appLabel(account);

/** O id de uma máquina nas ligações: o servidor e o vmid. */
export const guestTargetId = (serverId: string, vmid: number) =>
  `${serverId}:${vmid}`;

export type DocWithLinks = Doc & { links: DocLink[] };

export interface DocTarget {
  type: DocLinkType;
  targetId: string;
  label: string;
  group: string; // o servidor de uma máquina, o tipo de uma app…
  provider?: string; // a app (APP): o fornecedor, para sugerir documentos só às que se atualizam
}

export interface DocWrite {
  title?: string;
  kind?: DocKind;
  content?: string;
  summary?: string | null;
  tags?: string[];
  links?: DocLinkDto[];
}

/** Quem é avisado quando um documento (não registo) muda ou é apagado. */
export type DocChangeListener = (
  userId: string,
  doc: Pick<Doc, 'id' | 'title' | 'kind'>,
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
      owner: doc.owner,
      tags: doc.tags,
      summary: doc.summary,
      links: doc.links,
      sectionId: doc.sectionId,
      parentId: doc.parentId,
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
      orderBy: [{ kind: 'asc' }, { title: 'asc' }],
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

  // ── Escrever ────────────────────────────────────────────────────────────

  async create(userId: string, input: CreateDocDto, author: DocAuthor) {
    const place = await this.placement(userId, input);
    return this.prisma.doc.create({
      data: {
        userId,
        ...place,
        title: input.title.trim(),
        kind: input.kind ?? DocKind.RULES,
        owner: author.kind === 'user' ? DocOwner.USER : DocOwner.AGENT,
        content: input.content ?? '',
        summary: input.summary?.trim() || null,
        tags: cleanTags(input.tags) ?? [],
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
    const place = await this.placement(userId, input, doc.id);
    const title = input.title?.trim() ?? doc.title;
    const content = input.content ?? doc.content;
    const textChanged = title !== doc.title || content !== doc.content;
    if (textChanged) {
      await this.saveVersion(doc);
    }
    const saved = await this.prisma.doc.update({
      where: { id },
      data: {
        title,
        content,
        kind: input.kind,
        summary:
          input.summary === undefined
            ? undefined
            : input.summary?.trim() || null,
        tags: cleanTags(input.tags),
        updatedBy: authorName(author),
        ...place,
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
    if (textChanged || input.links || input.kind !== undefined) {
      this.changed(userId, saved);
    }
    if (place.sectionId !== undefined && place.sectionId !== doc.sectionId) {
      await this.moveDescendants(id, place.sectionId);
    }
    return saved;
  }

  /**
   * Onde fica um documento na árvore. Com pai, vai para a secção do pai (os filhos
   * seguem sempre o pai); um pai não pode ser o próprio nem um descendente dele.
   * Os campos que não vieram ficam como estão (undefined).
   */
  private async placement(
    userId: string,
    input: { sectionId?: string | null; parentId?: string | null },
    selfId?: string,
  ): Promise<{ sectionId?: string | null; parentId?: string | null }> {
    const place: { sectionId?: string | null; parentId?: string | null } = {};
    if (input.parentId !== undefined) {
      const parentId = input.parentId || null;
      if (parentId) {
        const parent = await this.findOwned(userId, parentId);
        if (selfId && (await this.isDescendant(parentId, selfId))) {
          throw new BadRequestException(
            'Um documento não pode ficar por baixo dele próprio nem de um subdocumento dele.',
          );
        }
        place.parentId = parentId;
        place.sectionId = parent.sectionId;
        return place;
      }
      place.parentId = null;
    }
    if (input.sectionId !== undefined) {
      const sectionId = input.sectionId || null;
      if (sectionId) {
        const section = await this.prisma.docSection.findFirst({
          where: { id: sectionId, userId },
        });
        if (!section) throw new NotFoundException('Secção não encontrada');
      }
      place.sectionId = sectionId;
    }
    return place;
  }

  /** Se `candidate` é o próprio `ancestor` ou está por baixo dele. */
  private async isDescendant(candidate: string, ancestor: string) {
    let current: string | null = candidate;
    for (let depth = 0; current && depth < 50; depth += 1) {
      if (current === ancestor) return true;
      const doc: { parentId: string | null } | null =
        await this.prisma.doc.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = doc?.parentId ?? null;
    }
    return false;
  }

  /** Os subdocumentos (e os deles) mudam de secção com o pai. */
  private async moveDescendants(id: string, sectionId: string | null) {
    let parents = [id];
    for (let depth = 0; parents.length && depth < 20; depth += 1) {
      const children = await this.prisma.doc.findMany({
        where: { parentId: { in: parents } },
        select: { id: true },
      });
      if (!children.length) return;
      await this.prisma.doc.updateMany({
        where: { id: { in: children.map((child) => child.id) } },
        data: { sectionId },
      });
      parents = children.map((child) => child.id);
    }
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

  /** As propostas por decidir, cada uma com `changes`: o que muda além do texto. */
  async proposals(userId: string) {
    const [proposals, sections] = await Promise.all([
      this.prisma.docProposal.findMany({
        where: { userId, status: DocProposalStatus.PENDING },
        include: {
          doc: {
            select: {
              id: true,
              title: true,
              content: true,
              tags: true,
              sectionId: true,
              links: { select: { type: true, targetId: true, label: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.docSection.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
    ]);
    const sectionName = (id: string | null) =>
      id ? (sections.find((section) => section.id === id)?.name ?? null) : null;
    return proposals.map((proposal) => ({
      ...proposal,
      changes: proposalChanges(
        this.organizeOf(proposal),
        proposal.doc,
        sectionName,
      ),
    }));
  }

  /**
   * A arrumação de uma proposta. As antigas (antes do campo organize) traziam as
   * ligações e as etiquetas soltas; numa edição também contam.
   */
  private organizeOf(proposal: {
    action: DocProposalAction;
    organize: Prisma.JsonValue;
    links: Prisma.JsonValue;
    tags: string[];
  }): ProposalOrganize | null {
    const organize = readOrganize(proposal.organize);
    if (organize || proposal.action === DocProposalAction.CREATE)
      return organize;
    const links = proposal.links as unknown as ProposalOrganize['links'] | null;
    if (!links && !proposal.tags.length) return null;
    return {
      ...(links ? { links } : {}),
      ...(proposal.tags.length ? { tags: proposal.tags } : {}),
    };
  }

  /** Uma secção pelo id ou pelo nome (sem ligar a maiúsculas nem acentos). */
  async findSection(userId: string, value: string) {
    const sections = await this.prisma.docSection.findMany({
      where: { userId },
      select: { id: true, name: true, parentId: true },
    });
    const wanted = normalizeText(value.trim());
    return (
      sections.find((section) => section.id === value.trim()) ??
      sections.find((section) => normalizeText(section.name) === wanted) ??
      null
    );
  }

  /** O sectionId a gravar: a secção pedida, ou uma nova (criada agora, no topo). */
  private async sectionIdFor(
    userId: string,
    section: NonNullable<ProposalOrganize['section']>,
  ): Promise<string | null> {
    if (!('name' in section)) return section.id;
    const existing = await this.findSection(userId, section.name);
    if (existing) return existing.id;
    const created = await this.prisma.docSection.create({
      data: { userId, name: section.name.trim(), parentId: null },
      select: { id: true },
    });
    return created.id;
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
      tags?: string[];
      /** CREATE: os documentos que o novo junta; aprovada a proposta, apagam-se. */
      replaces?: string[];
      /** A arrumação (título, etiquetas, ligações, secção) a aplicar ao aprovar. */
      organize?: ProposalOrganize;
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
        tags: cleanTags(input.tags) ?? [],
        replaces: input.replaces ?? [],
        organize: input.organize
          ? (input.organize as unknown as Prisma.InputJsonValue)
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
    const organize = this.organizeOf(proposal);
    let doc: DocWithLinks;
    if (proposal.action === DocProposalAction.CREATE || !proposal.docId) {
      doc = await this.create(
        userId,
        {
          title: proposal.title ?? 'Documento novo',
          kind: proposal.kind ?? DocKind.RULES,
          content: text,
          tags: proposal.tags,
          // As ligações aos documentos que este junta caem com eles.
          links: (
            (proposal.links as unknown as DocLinkDto[] | null) ?? []
          ).filter(
            (link) =>
              link.type !== DocLinkType.DOC ||
              !proposal.replaces.includes(link.targetId),
          ),
        },
        { kind: 'user' },
      );
      // Juntou outros documentos num só: os antigos saem (as versões vão com eles).
      for (const id of proposal.replaces) {
        const old = await this.prisma.doc.findFirst({ where: { id, userId } });
        if (old && old.id !== doc.id) await this.remove(userId, old.id);
      }
      if (organize?.section) {
        doc = await this.update(
          userId,
          doc.id,
          { sectionId: await this.sectionIdFor(userId, organize.section) },
          { kind: 'user' },
        );
      }
    } else {
      const current = await this.findOwned(userId, proposal.docId);
      // Uma proposta que substitui tudo, feita sobre uma versão mais antiga, apagava o que
      // mudou depois: só se aprova com o texto revisto (ou rejeita-se).
      const textChange = proposal.action !== DocProposalAction.ORGANIZE;
      if (
        proposal.action === DocProposalAction.EDIT &&
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
          ...(textChange
            ? {
                content:
                  proposal.action === DocProposalAction.APPEND
                    ? `${current.content.trimEnd()}\n${text.trim()}\n`
                    : text,
              }
            : {}),
          // A arrumação vai junto: antes ficava de fora e as ligações perdiam-se.
          title: organize?.title,
          tags: organize?.tags,
          links: organize?.links,
          ...(organize?.section
            ? { sectionId: await this.sectionIdFor(userId, organize.section) }
            : {}),
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

  /**
   * Os documentos como aparecem na página Documentos: as secções dele (em árvore) e,
   * para os que não estão numa secção, os grupos automáticos (docAutoGroup).
   */
  async layout(userId: string) {
    const [docs, sections] = await Promise.all([
      this.prisma.doc.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          kind: true,
          tags: true,
          sectionId: true,
          parentId: true,
          links: { select: { type: true, targetId: true, label: true } },
        },
        orderBy: { title: 'asc' },
      }),
      this.prisma.docSection.findMany({
        where: { userId },
        select: { id: true, name: true, parentId: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return {
      sections,
      docs: docs.map((doc) => ({
        ...doc,
        autoGroup: docAutoGroup(doc),
      })),
    };
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
          where: { userId, disconnectedAt: null },
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
        label: accountLinkLabel(account),
        group: PROVIDER_NAMES[account.provider],
        provider: account.provider,
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
   * O índice que vai nas instruções de um agente: uma linha por documento (sem os
   * registos). Os documentos não vão inteiros: o agente lê os que o pedido toca, pelos
   * títulos, pelas etiquetas e pelo que estão ligados (docsFor). Só muda quando os
   * documentos mudam, por isso não estraga a cache entre conversas.
   */
  async agentContext(userId: string): Promise<{ index: string[] }> {
    const docs = await this.prisma.doc.findMany({
      where: { userId, kind: { not: DocKind.LOG } },
      include: { links: true },
      orderBy: [{ kind: 'asc' }, { title: 'asc' }],
      take: INDEX_LIMIT,
    });
    return { index: docs.map(describeDoc) };
  }

  /**
   * Os documentos que um agente tem de ler antes de mexer no que o pedido toca: os
   * ligados a ele e aos projetos em que trabalha, e os que o pedido menciona — pelo
   * nome daquilo a que estão ligados (a app, a máquina, o servidor) ou por uma etiqueta.
   */
  async docsFor(
    userId: string,
    text: string,
    agentKey?: string,
  ): Promise<DocWithLinks[]> {
    const haystack = normalizeText(text);
    const [docs, projects] = await Promise.all([
      this.prisma.doc.findMany({
        where: { userId, kind: { not: DocKind.LOG } },
        include: { links: true },
        orderBy: { title: 'asc' },
      }),
      agentKey
        ? this.prisma.project.findMany({
            where: { userId, agentKeys: { has: agentKey } },
            select: { id: true },
          })
        : Promise.resolve([] as { id: string }[]),
    ]);
    const myProjects = new Set(projects.map((project) => project.id));
    return docs.filter(
      (doc) =>
        doc.links.some(
          (link) =>
            (link.type === DocLinkType.AGENT && link.targetId === agentKey) ||
            (link.type === DocLinkType.PROJECT &&
              myProjects.has(link.targetId)),
        ) ||
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
  ): Promise<DocWithLinks[]> {
    return this.prisma.doc.findMany({
      where: {
        userId,
        kind: { not: DocKind.LOG },
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

  /**
   * As regras gerais (sem ligações) de uma área, pelas etiquetas: as das atualizações
   * têm #atualizacao ou #servidor ("Atualizações das apps…", "Regras gerais do servidor").
   */
  generalRules(userId: string, tags: string[]): Promise<DocWithLinks[]> {
    return this.prisma.doc.findMany({
      where: {
        userId,
        kind: DocKind.RULES,
        links: { none: {} },
        tags: { hasSome: tags },
      },
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
      where: { userId, disconnectedAt: null },
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
        label: accountLinkLabel(account),
      })),
    )) {
      if (existing.has(normalizeText(starter.title))) continue;
      created.push(await this.create(userId, starter, { kind: 'user' }));
    }
    return created;
  }

  /** Os conjuntos de documentos prontos (o exemplo e os da comunidade). */
  templateSets() {
    return listTemplateSets();
  }

  /**
   * Cria os documentos de um conjunto que ainda não existem (pelo título), ligados às
   * apps dele desses fornecedores, ao primeiro servidor e aos agentes indicados. Um
   * documento de uma app que ele não tem ligada fica de fora.
   */
  async applyTemplateSet(userId: string, id: string) {
    const loaded = await loadTemplateSet(id);
    if (!loaded)
      throw new NotFoundException('Este conjunto de documentos já não existe.');
    const [accounts, server, agents, existingDocs] = await Promise.all([
      this.prisma.connectedAccount.findMany({
        where: { userId, disconnectedAt: null },
      }),
      this.prisma.serverConnection.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.agent.findMany({ where: { userId } }),
      this.prisma.doc.findMany({ where: { userId }, select: { title: true } }),
    ]);
    const existing = new Set(
      existingDocs.map((doc) => normalizeText(doc.title)),
    );
    const created: DocWithLinks[] = [];
    for (const template of loaded.docs) {
      if (existing.has(normalizeText(template.title))) continue;
      const apps = accounts.filter((account) =>
        template.apps.includes(account.provider),
      );
      if (template.apps.length && !apps.length) continue;
      const links: DocLinkDto[] = [
        ...apps.map((account) => ({
          type: DocLinkType.APP,
          targetId: account.id,
          label: accountLinkLabel(account),
        })),
        ...(template.server && server
          ? [
              {
                type: DocLinkType.SERVER,
                targetId: server.id,
                label: server.name,
              },
            ]
          : []),
        ...template.agents.flatMap((key) => {
          const agent = agents.find(
            (item) => item.key === key || item.template === key,
          );
          return agent
            ? [
                {
                  type: DocLinkType.AGENT,
                  targetId: agent.key,
                  label: agent.name,
                },
              ]
            : [];
        }),
      ];
      created.push(
        await this.create(
          userId,
          {
            title: template.title,
            kind: template.kind,
            content: template.content,
            summary: template.summary,
            tags: template.tags,
            links,
          },
          { kind: 'user' },
        ),
      );
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
  MAP: 'mapa',
  LOG: 'registo',
};

/** Uma linha do índice: "[regras] Home Assistant – regras (id) → App Home Assistant #atualizacao — resumo". */
export function describeDoc(
  doc: Pick<
    DocWithLinks,
    'id' | 'title' | 'kind' | 'links' | 'tags' | 'summary'
  >,
): string {
  const flags = KIND_NAMES[doc.kind];
  const links = doc.links.length
    ? ` → ${doc.links.map((link) => link.label).join(', ')}`
    : ' → geral';
  const tags = doc.tags.length ? ` #${doc.tags.join(' #')}` : '';
  return `[${flags}] ${doc.title} (${doc.id})${links}${tags}${doc.summary ? ` — ${doc.summary}` : ''}`;
}
