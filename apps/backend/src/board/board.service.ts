import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TodoService } from 'src/todo/todo.service';
import {
  AgentScheduleRepeat,
  AppUpdateStatus,
  BoardStateGroup,
  DocLinkType,
  Prisma,
  ProjectKind,
  TaskPriority,
} from 'src/generated/prisma/client/client';
import {
  CLOSED_GROUPS,
  GENERAL_STATES,
  UPDATE_STATES,
} from './helpers/defaultStates';
import { projectIdentifier, taskKey } from './helpers/projectIdentifier';
import { isInstallApproval } from './helpers/isInstallApproval';
import { updatesAgentKey } from 'src/agent/helpers/updatesAgentKey';

export interface ProjectInput {
  name?: string;
  identifier?: string;
  description?: string;
  agentKeys?: string[];
  color?: number;
  serverConnectionId?: string | null;
}

export interface TaskInput {
  projectId?: string;
  title?: string;
  description?: string;
  stateId?: string;
  /** Em vez de stateId: a coluna pela chave (só no projeto das atualizações). */
  stateKey?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
  startDate?: Date | null;
  dueDate?: Date | null;
  parentId?: string | null;
  moduleIds?: string[];
  /** Em vez de moduleIds: os nomes (criam-se se faltarem). */
  moduleNames?: string[];
  position?: number;
  updateId?: string | null;
  cycleId?: string | null;
}

export interface TaskFilter {
  projectId?: string;
  stateId?: string;
  search?: string;
  priority?: TaskPriority;
  assignee?: string;
  label?: string;
  moduleId?: string;
  cycleId?: string;
  open?: boolean;
}

/** Quem mexeu: o utilizador, um agente (a chave) ou o próprio MyHomeLab. */
export type BoardActor = string;

/** Quem é avisado quando uma tarefa muda de coluna (as atualizações seguem o quadro). */
export type StateListener = (change: {
  taskId: string;
  updateId: string | null;
  fromKey: string | null;
  toKey: string | null;
  dueDate: Date | null;
  actor: BoardActor;
}) => Promise<void>;

const PRIORITY_NAMES: Record<TaskPriority, string> = {
  NONE: 'sem prioridade',
  LOW: 'baixa',
  MEDIUM: 'média',
  HIGH: 'alta',
  URGENT: 'urgente',
};

const TITLE_MAX = 250;
const DESCRIPTION_MAX = 50_000;
const COMMENT_MAX = 20_000;
/** A conversa de uma tarefa leva os últimos comentários e a descrição cortada. */
/** A lista das Tarefas onde ficam as perguntas dos agentes nas tarefas dos projetos. */
const QUESTION_LIST = 'Projetos';

/** A tarefa "Responder: …" de uma pergunta (uma por tarefa do quadro). */
const questionSubject = (taskId: string) => `board-question:${taskId}`;

/** O dia de hoje (meia-noite UTC do dia em Portugal): o prazo de uma resposta. */
const todayInLisbon = () =>
  new Date(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())}T00:00:00Z`,
  );

const CHAT_COMMENTS = 10;
const CHAT_TEXT_MAX = 3000;

const withState = {
  state: true,
  modules: { include: { module: true } },
  project: { select: { id: true, name: true, identifier: true, kind: true } },
  _count: { select: { comments: true, children: true } },
} satisfies Prisma.BoardTaskInclude;

type TaskRow = Prisma.BoardTaskGetPayload<{ include: typeof withState }>;

const day = (date: Date | null) =>
  date
    ? date.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' })
    : 'sem data';

/**
 * O quadro de tarefas do MyHomeLab (Projetos): projetos com colunas e módulos,
 * tarefas com comentários, links, documentos e disparos. Um comentário do
 * utilizador põe o agente responsável a trabalhar (um disparo agora).
 */
@Injectable()
export class BoardService {
  private readonly logger = new Logger(BoardService.name);
  private listeners: StateListener[] = [];

  /** A chave do agente que trata das atualizações (fica nas tarefas dele). */
  updatesAgentKey(userId: string): Promise<string> {
    return updatesAgentKey(this.prisma, userId);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly todos: TodoService,
  ) {}

  onStateChange(listener: StateListener) {
    this.listeners.push(listener);
  }

  // ── Projetos ────────────────────────────────────────────────────────────

  async projects(userId: string) {
    await this.ensureUpdatesProject(userId);
    const projects = await this.prisma.project.findMany({
      where: { userId },
      include: {
        states: { orderBy: { position: 'asc' } },
        modules: { orderBy: { position: 'asc' } },
        cycles: { orderBy: { startDate: 'desc' } },
      },
      orderBy: [{ kind: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    });
    const counts = await this.prisma.boardTask.groupBy({
      by: ['projectId', 'stateId'],
      where: { userId },
      _count: { _all: true },
    });
    const docs = await this.prisma.docLink.groupBy({
      by: ['targetId'],
      where: { type: DocLinkType.PROJECT, doc: { userId } },
      _count: { _all: true },
    });
    const docCount = new Map(
      docs.map((row) => [row.targetId, row._count._all]),
    );
    return projects.map((project) => {
      const closed = new Set(
        project.states
          .filter((state) => CLOSED_GROUPS.includes(state.group))
          .map((state) => state.id),
      );
      const rows = counts.filter((row) => row.projectId === project.id);
      return {
        ...project,
        docCount: docCount.get(project.id) ?? 0,
        taskCount: rows.reduce((sum, row) => sum + row._count._all, 0),
        openCount: rows
          .filter((row) => !closed.has(row.stateId))
          .reduce((sum, row) => sum + row._count._all, 0),
      };
    });
  }

  async project(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        states: { orderBy: { position: 'asc' } },
        modules: { orderBy: { position: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException('Este projeto já não existe.');
    return project;
  }

  async createProject(userId: string, input: ProjectInput) {
    const data = await this.validProject(userId, input, null);
    const count = await this.prisma.project.count({ where: { userId } });
    return this.prisma.project.create({
      data: {
        userId,
        ...data,
        position: count,
        states: {
          create: GENERAL_STATES.map((state, position) => ({
            ...state,
            position,
          })),
        },
      },
      include: { states: true, modules: true },
    });
  }

  async updateProject(userId: string, id: string, input: ProjectInput) {
    const current = await this.project(userId, id);
    const data = await this.validProject(userId, input, current);
    const project = await this.prisma.project.update({
      where: { id },
      data,
      include: { states: { orderBy: { position: 'asc' } }, modules: true },
    });
    if (project.name !== current.name) {
      // O nome que os documentos mostram (e que os agentes procuram nos pedidos).
      await this.prisma.docLink.updateMany({
        where: { type: DocLinkType.PROJECT, targetId: id },
        data: { label: project.name },
      });
    }
    return project;
  }

  /** As tarefas vão com o projeto; os documentos ficam, só deixam de estar ligados. */
  async removeProject(userId: string, id: string) {
    const project = await this.project(userId, id);
    if (project.kind === ProjectKind.UPDATES) {
      throw new BadRequestException(
        'O projeto das atualizações não se apaga (é onde entram as versões novas das apps).',
      );
    }
    const tasks = await this.prisma.boardTask.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const taskIds = tasks.map((task) => task.id);
    await this.prisma.$transaction([
      this.prisma.docLink.deleteMany({
        where: {
          doc: { userId },
          OR: [
            { type: DocLinkType.PROJECT, targetId: id },
            { type: DocLinkType.TASK, targetId: { in: taskIds } },
          ],
        },
      }),
      this.prisma.agentSchedule.updateMany({
        where: {
          userId,
          OR: [
            { linkType: DocLinkType.PROJECT, targetId: id },
            { linkType: DocLinkType.TASK, targetId: { in: taskIds } },
          ],
        },
        data: {
          linkType: null,
          targetId: null,
          targetLabel: null,
          enabled: false,
        },
      }),
      this.prisma.project.delete({ where: { id } }),
    ]);
  }

  /** O projeto onde entram as atualizações das apps (criado na primeira vez). */
  async ensureUpdatesProject(userId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { userId, kind: ProjectKind.UPDATES },
      include: { states: true, modules: true },
    });
    if (existing) {
      const missing = UPDATE_STATES.filter(
        (seed) => !existing.states.some((state) => state.key === seed.key),
      );
      if (!missing.length) return existing;
      await this.prisma.boardState.createMany({
        data: missing.map((seed) => ({
          ...seed,
          projectId: existing.id,
          position: UPDATE_STATES.indexOf(seed),
        })),
      });
      return this.prisma.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: { states: true, modules: true },
      });
    }
    const servers = await this.prisma.serverConnection.findMany({
      where: { userId },
      select: { id: true },
    });
    return this.prisma.project.create({
      data: {
        userId,
        name: 'Servidor - 1',
        serverConnectionId: servers.length === 1 ? servers[0].id : null,
        identifier: 'ATU',
        kind: ProjectKind.UPDATES,
        description:
          'As versões novas das apps deste servidor. Cada uma é uma tarefa: é estudada (uma de cada vez) e fica em Waiting for reply com a recomendação, ou em Recheck later. Quando a pões em Ready to update, instala-se logo (uma de cada vez).',
        agentKeys: [await updatesAgentKey(this.prisma, userId)],
        states: {
          create: UPDATE_STATES.map((state, position) => ({
            ...state,
            position,
          })),
        },
      },
      include: { states: true, modules: true },
    });
  }

  // ── Colunas e módulos ───────────────────────────────────────────────────

  async createState(
    userId: string,
    projectId: string,
    input: {
      name: string;
      group?: BoardStateGroup;
      color?: string;
      phase?: string;
    },
  ) {
    const project = await this.project(userId, projectId);
    const name = input.name?.trim().slice(0, 60);
    if (!name) throw new BadRequestException('Dá um nome à coluna.');
    return this.prisma.boardState.create({
      data: {
        projectId,
        name,
        group: input.group ?? BoardStateGroup.UNSTARTED,
        color: input.color ?? '#8a94a6',
        phase: input.phase?.trim().slice(0, 40) || null,
        position: project.states.length,
      },
    });
  }

  async updateState(
    userId: string,
    stateId: string,
    input: {
      name?: string;
      group?: BoardStateGroup;
      color?: string;
      position?: number;
      phase?: string;
    },
  ) {
    const state = await this.ownedState(userId, stateId);
    const data: Prisma.BoardStateUpdateInput = {};
    if (input.name !== undefined) {
      const name = input.name.trim().slice(0, 60);
      if (!name) throw new BadRequestException('Dá um nome à coluna.');
      data.name = name;
    }
    if (input.color) data.color = input.color;
    if (input.phase !== undefined)
      data.phase = input.phase.trim().slice(0, 40) || null;
    // As colunas do MyHomeLab (as das atualizações) mantêm o grupo.
    if (input.group && !state.key) data.group = input.group;
    if (input.position !== undefined) {
      const states = await this.prisma.boardState.findMany({
        where: { projectId: state.projectId },
        orderBy: { position: 'asc' },
      });
      const order = states.filter((item) => item.id !== stateId);
      order.splice(
        Math.max(0, Math.min(input.position, order.length)),
        0,
        state,
      );
      await this.prisma.$transaction(
        order.map((item, position) =>
          this.prisma.boardState.update({
            where: { id: item.id },
            data: { position },
          }),
        ),
      );
    }
    return this.prisma.boardState.update({ where: { id: stateId }, data });
  }

  async removeState(userId: string, stateId: string) {
    const state = await this.ownedState(userId, stateId);
    if (state.key) {
      throw new BadRequestException(
        'Esta coluna é usada pelas atualizações: muda-lhe o nome, mas não a apagues.',
      );
    }
    const tasks = await this.prisma.boardTask.count({ where: { stateId } });
    if (tasks) {
      throw new BadRequestException(
        `Esta coluna tem ${tasks} tarefa(s): passa-as para outra antes de a apagar.`,
      );
    }
    await this.prisma.boardState.delete({ where: { id: stateId } });
  }

  async createModule(
    userId: string,
    projectId: string,
    input: { name: string; description?: string },
  ) {
    const project = await this.project(userId, projectId);
    const name = input.name?.trim().slice(0, 80);
    if (!name) throw new BadRequestException('Dá um nome ao módulo.');
    if (
      project.modules.some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new BadRequestException(`Já há um módulo "${name}".`);
    }
    return this.prisma.boardModule.create({
      data: {
        projectId,
        name,
        description: input.description?.trim().slice(0, 4000) ?? '',
        position: project.modules.length,
      },
    });
  }

  async updateModule(
    userId: string,
    moduleId: string,
    input: { name?: string; description?: string },
  ) {
    await this.ownedModule(userId, moduleId);
    const name = input.name?.trim().slice(0, 80);
    if (input.name !== undefined && !name) {
      throw new BadRequestException('Dá um nome ao módulo.');
    }
    return this.prisma.boardModule.update({
      where: { id: moduleId },
      data: {
        ...(name ? { name } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim().slice(0, 4000) }
          : {}),
      },
    });
  }

  async removeModule(userId: string, moduleId: string) {
    await this.ownedModule(userId, moduleId);
    await this.prisma.boardModule.delete({ where: { id: moduleId } });
  }

  // ── Tarefas ─────────────────────────────────────────────────────────────

  async tasks(userId: string, filter: TaskFilter = {}) {
    const words = filter.search?.trim();
    const number = words && /^[a-z0-9]+-(\d+)$/i.exec(words);
    const rows = await this.prisma.boardTask.findMany({
      where: {
        userId,
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
        ...(filter.stateId ? { stateId: filter.stateId } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
        ...(filter.assignee ? { assignee: filter.assignee } : {}),
        ...(filter.label ? { labels: { has: filter.label } } : {}),
        ...(filter.moduleId
          ? { modules: { some: { moduleId: filter.moduleId } } }
          : {}),
        ...(filter.cycleId ? { cycleId: filter.cycleId } : {}),
        ...(filter.open ? { state: { group: { notIn: CLOSED_GROUPS } } } : {}),
        ...(words
          ? number
            ? { number: Number(number[1]) }
            : {
                OR: [
                  { title: { contains: words, mode: 'insensitive' } },
                  { description: { contains: words, mode: 'insensitive' } },
                ],
              }
          : {}),
      },
      include: withState,
      orderBy: [{ position: 'asc' }, { number: 'desc' }],
      take: 1000,
    });
    return rows.map((row) => this.view(row));
  }

  async task(userId: string, id: string) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: {
        ...withState,
        comments: { orderBy: { createdAt: 'asc' } },
        links: { orderBy: { createdAt: 'asc' } },
        activity: { orderBy: { createdAt: 'desc' }, take: 100 },
        children: { include: { state: true }, orderBy: { number: 'asc' } },
        parent: { select: { id: true, number: true, title: true } },
        cycle: true,
        conversation: { select: { id: true, lastMessageAt: true } },
        attachments: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            createdBy: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        relations: {
          include: { to: { include: { state: true, project: true } } },
        },
        relatedTo: {
          include: { from: { include: { state: true, project: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    const [docs, schedules, update] = await Promise.all([
      this.prisma.doc.findMany({
        where: {
          userId,
          links: { some: { type: DocLinkType.TASK, targetId: id } },
        },
        select: {
          id: true,
          title: true,
          kind: true,
          required: true,
          summary: true,
        },
        orderBy: { title: 'asc' },
      }),
      this.prisma.agentSchedule.findMany({
        where: {
          userId,
          OR: [
            { linkType: DocLinkType.TASK, targetId: id },
            ...(task.updateId ? [{ updateId: task.updateId }] : []),
          ],
        },
        include: { runs: { orderBy: { startedAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
      task.updateId
        ? this.prisma.appUpdate.findUnique({
            where: { id: task.updateId },
            select: {
              id: true,
              status: true,
              logDocId: true,
              accountId: true,
              question: true,
              fromVersion: true,
              toVersion: true,
            },
          })
        : null,
    ]);
    return {
      ...this.view(task),
      comments: task.comments,
      links: task.links,
      activity: task.activity,
      children: task.children.map((child) => ({
        id: child.id,
        key: taskKey(task.project.identifier, child.number),
        title: child.title,
        state: child.state,
      })),
      parent: task.parent
        ? {
            id: task.parent.id,
            key: taskKey(task.project.identifier, task.parent.number),
            title: task.parent.title,
          }
        : null,
      docs,
      schedules,
      update,
      cycle: task.cycle,
      conversation: task.conversation,
      attachments: task.attachments,
      relations: [
        ...task.relations.map((relation) => ({
          id: relation.id,
          kind: relation.kind,
          direction: 'from' as const,
          task: relatedView(relation.to),
        })),
        ...task.relatedTo.map((relation) => ({
          id: relation.id,
          kind: relation.kind,
          direction: 'to' as const,
          task: relatedView(relation.from),
        })),
      ],
    };
  }

  async createTask(userId: string, input: TaskInput, actor: BoardActor) {
    const projectId = input.projectId;
    if (!projectId) throw new BadRequestException('Escolhe o projeto.');
    const project = await this.project(userId, projectId);
    const title = input.title?.trim().slice(0, TITLE_MAX);
    if (!title) throw new BadRequestException('Dá um título à tarefa.');
    const stateId =
      this.pickState(project.states, input) ?? project.states[0]?.id;
    if (!stateId) throw new BadRequestException('O projeto não tem colunas.');
    const moduleIds = await this.moduleIdsFor(project, input);
    const parentId = input.parentId
      ? (await this.ownedTask(userId, input.parentId)).id
      : null;
    const task = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.project.update({
        where: { id: projectId },
        data: { nextNumber: { increment: 1 } },
        select: { nextNumber: true },
      });
      return tx.boardTask.create({
        data: {
          userId,
          projectId,
          number: counter.nextNumber - 1,
          title,
          description: (input.description ?? '').slice(0, DESCRIPTION_MAX),
          stateId,
          priority: input.priority ?? TaskPriority.NONE,
          assignee: input.assignee ?? null,
          labels: cleanLabels(input.labels ?? []),
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          parentId,
          createdBy: actor,
          updateId: input.updateId ?? null,
          cycleId: input.cycleId
            ? (await this.ownedCycle(userId, input.cycleId, projectId)).id
            : null,
          position: input.position ?? Date.now() / 1000,
          modules: { create: moduleIds.map((moduleId) => ({ moduleId })) },
          activity: { create: { actor, text: 'Criou a tarefa.' } },
        },
        include: withState,
      });
    });
    return this.view(task);
  }

  async updateTask(
    userId: string,
    id: string,
    input: TaskInput,
    actor: BoardActor,
  ) {
    const current = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: {
        ...withState,
        project: { include: { states: true, modules: true } },
      },
    });
    if (!current) throw new NotFoundException('Esta tarefa já não existe.');
    const changes: string[] = [];
    const data: Prisma.BoardTaskUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      const title = input.title.trim().slice(0, TITLE_MAX);
      if (!title) throw new BadRequestException('Dá um título à tarefa.');
      if (title !== current.title) {
        data.title = title;
        changes.push(`Mudou o título para "${title}".`);
      }
    }
    if (
      input.description !== undefined &&
      input.description !== current.description
    ) {
      data.description = input.description.slice(0, DESCRIPTION_MAX);
      if (actor !== 'MyHomeLab') changes.push('Mudou a descrição.');
    }
    const stateId = this.pickState(current.project.states, input);
    const nextState = stateId
      ? current.project.states.find((state) => state.id === stateId)
      : undefined;
    if (nextState && nextState.id !== current.stateId) {
      data.stateId = nextState.id;
      data.completedAt = CLOSED_GROUPS.includes(nextState.group)
        ? new Date()
        : null;
      changes.push(`${current.state.name} → ${nextState.name}.`);
    }
    if (input.priority && input.priority !== current.priority) {
      data.priority = input.priority;
      changes.push(`Prioridade ${PRIORITY_NAMES[input.priority]}.`);
    }
    if (input.assignee !== undefined && input.assignee !== current.assignee) {
      data.assignee = input.assignee;
      changes.push(
        input.assignee
          ? `Responsável: ${input.assignee === 'user' ? 'tu' : input.assignee}.`
          : 'Sem responsável.',
      );
    }
    if (input.labels) {
      const labels = cleanLabels(input.labels);
      if (labels.join('|') !== current.labels.join('|')) {
        data.labels = labels;
        changes.push(`Etiquetas: ${labels.join(', ') || 'nenhuma'}.`);
      }
    }
    if (
      input.startDate !== undefined &&
      sameDay(input.startDate, current.startDate) === false
    ) {
      data.startDate = input.startDate;
      if (actor !== 'MyHomeLab')
        changes.push(`Início: ${day(input.startDate)}.`);
    }
    if (
      input.dueDate !== undefined &&
      sameDay(input.dueDate, current.dueDate) === false
    ) {
      data.dueDate = input.dueDate;
      if (actor !== 'MyHomeLab') changes.push(`Prazo: ${day(input.dueDate)}.`);
    }
    if (input.parentId !== undefined && input.parentId !== current.parentId) {
      if (input.parentId === id)
        throw new BadRequestException(
          'Uma tarefa não é sub-tarefa dela própria.',
        );
      data.parentId = input.parentId
        ? (await this.ownedTask(userId, input.parentId)).id
        : null;
      changes.push(
        input.parentId ? 'Passou a sub-tarefa.' : 'Deixou de ser sub-tarefa.',
      );
    }
    if (input.position !== undefined) data.position = input.position;
    if (input.cycleId !== undefined && input.cycleId !== current.cycleId) {
      const cycle = input.cycleId
        ? await this.ownedCycle(userId, input.cycleId, current.projectId)
        : null;
      data.cycleId = cycle?.id ?? null;
      changes.push(cycle ? `Ciclo: ${cycle.name}.` : 'Saiu do ciclo.');
    }

    const moduleIds =
      input.moduleIds || input.moduleNames
        ? await this.moduleIdsFor(current.project, input)
        : null;
    await this.prisma.$transaction(async (tx) => {
      if (moduleIds) {
        await tx.boardTaskModule.deleteMany({ where: { taskId: id } });
        await tx.boardTaskModule.createMany({
          data: moduleIds.map((moduleId) => ({ taskId: id, moduleId })),
        });
        const names = current.project.modules
          .filter((item) => moduleIds.includes(item.id))
          .map((item) => item.name);
        const before = current.modules
          .map((item) => item.module.name)
          .sort()
          .join('|');
        if (before !== [...names].sort().join('|')) {
          changes.push(`Módulos: ${names.join(', ') || 'nenhum'}.`);
        }
      }
      await tx.boardTask.update({ where: { id }, data });
      if (changes.length) {
        await tx.boardTaskActivity.createMany({
          data: changes.map((text) => ({ taskId: id, actor, text })),
        });
      }
    });

    if (nextState && nextState.id !== current.stateId) {
      for (const listener of this.listeners) {
        await listener({
          taskId: id,
          updateId: current.updateId,
          fromKey: current.state.key,
          toKey: nextState.key,
          dueDate:
            input.dueDate !== undefined ? input.dueDate : current.dueDate,
          actor,
        }).catch((error: unknown) =>
          this.logger.warn(
            `Mudança de coluna (${id}): ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
      // Mudar a tarefa de coluna à mão também é uma resposta: fecha a pergunta.
      if (actor === 'user' && current.awaitingReply) {
        await this.closeQuestion(userId, id);
      }
    }
    return this.view(
      await this.prisma.boardTask.findUniqueOrThrow({
        where: { id },
        include: withState,
      }),
    );
  }

  async removeTask(userId: string, id: string) {
    const task = await this.ownedTask(userId, id);
    // A atualização pode já não existir (ex.: o servidor foi apagado): aí a tarefa apaga-se.
    if (
      task.updateId &&
      (await this.prisma.appUpdate.findUnique({
        where: { id: task.updateId },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException(
        'É a tarefa de uma atualização: passa-a para Cancelled em vez de a apagar.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.docLink.deleteMany({
        where: { type: DocLinkType.TASK, targetId: id },
      }),
      // Um disparo desta tarefa falava dela: sem ela fica desligado (pode voltar a ligar-se).
      this.prisma.agentSchedule.updateMany({
        where: { userId, linkType: DocLinkType.TASK, targetId: id },
        data: {
          linkType: null,
          targetId: null,
          targetLabel: null,
          enabled: false,
        },
      }),
      this.prisma.boardTask.delete({ where: { id } }),
    ]);
  }

  /**
   * Um comentário. O do utilizador fecha a pergunta que estava à espera dele e põe o
   * agente da tarefa a trabalhar (um disparo agora, que aparece nos Disparos).
   */
  async comment(userId: string, id: string, body: string, actor: BoardActor) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    const text = body.trim().slice(0, COMMENT_MAX);
    if (!text) throw new BadRequestException('Escreve o comentário.');
    const comment = await this.prisma.boardTaskComment.create({
      data: { taskId: id, author: actor, body: text },
    });
    if (actor !== 'user') return comment;
    if (task.awaitingReply) await this.closeQuestion(userId, id);
    // Um "sim" sozinho numa atualização à espera dele é o "Sim, instalar": vai já para
    // Ready to update, sem passar pelo agente (só ele aprova, e foi ele que escreveu).
    if (isInstallApproval(text)) {
      const waiting = await this.prisma.appUpdate.findFirst({
        where: { userId, boardTaskId: id, status: AppUpdateStatus.WAITING },
        select: { id: true },
      });
      if (waiting) {
        await this.updateTask(userId, id, { stateKey: 'ready' }, 'user');
        return comment;
      }
    }
    const mentioned = await this.mentionedAgents(userId, text);
    const agentKeys = mentioned.length
      ? mentioned
      : [await this.agentFor(userId, task)].filter((key): key is string =>
          Boolean(key),
        );
    for (const agentKey of agentKeys) {
      const key = taskKey(task.project.identifier, task.number);
      await this.prisma.agentSchedule.create({
        data: {
          userId,
          agentKey,
          title: `Comentário em ${key}`,
          instruction:
            `O utilizador comentou na tarefa ${key} "${task.title}":\n\n${text}\n\n` +
            `Lê a tarefa com board_get ${key} (a descrição, os comentários e o que está ligado) e faz o que ele pede, seguindo os documentos. ` +
            'Responde-lhe na própria tarefa com board_comment: o que fizeste ou o que precisas dele.',
          repeat: AgentScheduleRepeat.ONCE,
          runAt: new Date(),
          nextRunAt: new Date(),
          notify: false,
          createdBy: 'user',
          tags: ['comentário'],
          linkType: DocLinkType.TASK,
          targetId: id,
          targetLabel: `${key} ${task.title}`.slice(0, 200),
        },
      });
    }
    return comment;
  }

  /** Ele respondeu: a tarefa deixa de esperar e o "Responder: …" das Tarefas fica feito. */
  private async closeQuestion(userId: string, id: string) {
    await this.prisma.boardTask.update({
      where: { id },
      data: { awaitingReply: false },
    });
    await this.todos
      .closeSubject(userId, questionSubject(id), 'Respondida na tarefa.')
      .catch(() => undefined);
  }

  /** Ele falou na conversa da tarefa: conta como resposta. */
  async answeredInChat(userId: string, id: string) {
    const task = await this.ownedTask(userId, id);
    if (task.awaitingReply) await this.closeQuestion(userId, id);
  }

  /**
   * O que o Jarvis recebe na conversa de uma tarefa (em cada mensagem): a tarefa,
   * a atualização, se for de uma, e os últimos comentários.
   */
  async chatContext(userId: string, id: string): Promise<string> {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: {
        ...withState,
        comments: { orderBy: { createdAt: 'desc' }, take: CHAT_COMMENTS },
      },
    });
    if (!task) return '';
    const key = taskKey(task.project.identifier, task.number);
    const update = task.updateId
      ? await this.prisma.appUpdate.findUnique({
          where: { id: task.updateId },
          select: {
            id: true,
            status: true,
            question: true,
            fromVersion: true,
            toVersion: true,
          },
        })
      : null;
    return [
      `Esta conversa está ligada à tarefa ${key} "${task.title}" (projeto ${task.project.name}, coluna ${task.state.name}${task.dueDate ? `, prazo ${day(task.dueDate)}` : ''}).`,
      task.description.trim()
        ? `Descrição:\n${task.description.trim().slice(0, CHAT_TEXT_MAX)}`
        : '',
      update
        ? `É a atualização ${update.id} (${update.fromVersion} → ${update.toVersion}, ${update.status})${update.question ? `; à espera da resposta dele a: ${update.question}` : ''}.`
        : '',
      task.comments.length
        ? `Últimos comentários:\n${[...task.comments]
            .reverse()
            .map(
              (comment) =>
                `- ${comment.author} (${day(comment.createdAt)}): ${comment.body.slice(0, 500)}`,
            )
            .join('\n')}`
        : '',
      `O que ele disser aqui é a resposta às perguntas da tarefa. Quando ficar algo decidido, deixa na tarefa um comentário curto com board_comment ("Decidido no chat: …"). Se for uma atualização à espera da resposta dele, passa a decisão ao agente que trata das atualizações (update_set_status). Para mais, board_get ${key}.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * O agente precisa de uma resposta: fica o comentário, a tarefa passa a esperar por
   * ele e abre-se "Responder: …" em Tarefas (as das atualizações já têm a sua).
   */
  async askUser(
    userId: string,
    id: string,
    question: string,
    agentKey: string,
  ) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    // Numa atualização a pergunta vai pelo estado Waiting: é esse que lhe aparece
    // em Notificações → Precisa de ti, com os botões na tarefa.
    const fromUpdate = await this.prisma.appUpdate.findFirst({
      where: { boardTaskId: id },
      select: { id: true },
    });
    if (fromUpdate) {
      throw new BadRequestException(
        'Esta tarefa é de uma atualização: pergunta com update_set_status (status waiting, a pergunta no comment).',
      );
    }
    const key = taskKey(task.project.identifier, task.number);
    await this.comment(userId, id, `❓ ${question}`, agentKey);
    await this.prisma.boardTask.update({
      where: { id },
      data: { awaitingReply: true },
    });
    await this.todos.openSubject(userId, questionSubject(id), {
      list: QUESTION_LIST,
      title: `Responder: ${key} ${task.title}`.slice(0, 300),
      notes: `${question}\n\nResponde na tarefa (comentário) ou no chat do Jarvis.`,
      dueAt: todayInLisbon(),
      dueAllDay: true,
      priority: 'HIGH',
      links: [`/MyHomeLab/Projects/${id}`],
      agentName: agentKey,
    });
    return { key };
  }

  async addLink(
    userId: string,
    id: string,
    input: { title?: string; url: string },
    actor: BoardActor,
  ) {
    await this.ownedTask(userId, id);
    const url = input.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new BadRequestException(
        'O link tem de começar por http:// ou https://.',
      );
    }
    const existing = await this.prisma.boardTaskLink.findFirst({
      where: { taskId: id, url },
    });
    if (existing) return existing;
    const link = await this.prisma.boardTaskLink.create({
      data: {
        taskId: id,
        url,
        title: (input.title?.trim() || url).slice(0, 200),
      },
    });
    await this.prisma.boardTaskActivity.create({
      data: { taskId: id, actor, text: `Juntou o link "${link.title}".` },
    });
    return link;
  }

  async removeLink(userId: string, id: string, linkId: string) {
    await this.ownedTask(userId, id);
    await this.prisma.boardTaskLink.deleteMany({
      where: { id: linkId, taskId: id },
    });
  }

  /** Liga um documento à tarefa (aparece também nos documentos, como ligação). */
  async linkDoc(userId: string, id: string, docId: string, actor: BoardActor) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    const doc = await this.prisma.doc.findFirst({
      where: { id: docId, userId },
    });
    if (!doc) throw new NotFoundException('Este documento já não existe.');
    const label =
      `${taskKey(task.project.identifier, task.number)} ${task.title}`.slice(
        0,
        200,
      );
    const existing = await this.prisma.docLink.findFirst({
      where: { docId, type: DocLinkType.TASK, targetId: id },
    });
    if (!existing) {
      await this.prisma.docLink.create({
        data: { docId, type: DocLinkType.TASK, targetId: id, label },
      });
      await this.prisma.boardTaskActivity.create({
        data: { taskId: id, actor, text: `Ligou o documento "${doc.title}".` },
      });
    }
  }

  async unlinkDoc(userId: string, id: string, docId: string) {
    await this.ownedTask(userId, id);
    await this.prisma.docLink.deleteMany({
      where: { docId, type: DocLinkType.TASK, targetId: id, doc: { userId } },
    });
  }

  /** Para os agentes: o id ou a chave ("ATU-12"). */
  async findForAgent(userId: string, ref: string) {
    const clean = ref.trim();
    const key = /^([a-z0-9]+)-(\d+)$/i.exec(clean);
    const task = key
      ? await this.prisma.boardTask.findFirst({
          where: {
            userId,
            number: Number(key[2]),
            project: { identifier: key[1].toUpperCase() },
          },
        })
      : await this.prisma.boardTask.findFirst({ where: { id: clean, userId } });
    return task ?? `Não há nenhuma tarefa "${ref}". Vê-as com board_list.`;
  }

  /** A tarefa de uma atualização (para as atualizações a moverem sozinhas). */
  taskOfUpdate(updateId: string) {
    return this.prisma.boardTask.findUnique({
      where: { updateId },
      include: withState,
    });
  }

  // ── Interno ─────────────────────────────────────────────────────────────

  private view(task: TaskRow) {
    const { modules, _count, project, ...rest } = task;
    return {
      ...rest,
      key: taskKey(project.identifier, task.number),
      project,
      modules: modules.map((item) => ({
        id: item.module.id,
        name: item.module.name,
      })),
      commentCount: _count.comments,
      childCount: _count.children,
    };
  }

  /** Os agentes mencionados num comentário (@infra, @Jarvis…). */
  private async mentionedAgents(
    userId: string,
    text: string,
  ): Promise<string[]> {
    const mentions = [...text.matchAll(/@([\p{L}\p{N}_-]+)/gu)].map((match) =>
      match[1].toLowerCase(),
    );
    if (!mentions.length) return [];
    const agents = await this.prisma.agent.findMany({
      where: { userId, isActive: true },
      select: { key: true, name: true },
    });
    return agents
      .filter((agent) =>
        mentions.some(
          (mention) =>
            agent.key.toLowerCase() === mention ||
            agent.name.toLowerCase().split(/\s+/)[0] === mention,
        ),
      )
      .map((agent) => agent.key);
  }

  async ownedCycle(userId: string, id: string, projectId?: string) {
    const cycle = await this.prisma.boardCycle.findFirst({
      where: { id, project: { userId }, ...(projectId ? { projectId } : {}) },
    });
    if (!cycle)
      throw new NotFoundException(
        'Este ciclo já não existe (ou é de outro projeto).',
      );
    return cycle;
  }

  /** Quem trabalha quando ele comenta: o responsável (agente), o das atualizações ou o do projeto. */
  private async agentFor(
    userId: string,
    task: {
      assignee: string | null;
      updateId: string | null;
      project: { agentKeys: string[] };
    },
  ): Promise<string | null> {
    const agents = await this.prisma.agent.findMany({
      where: { userId, isActive: true },
      select: { key: true, tools: true, reportsToId: true },
    });
    const active = (key: string | null | undefined) =>
      key && key !== 'user' && agents.some((agent) => agent.key === key)
        ? key
        : null;
    return (
      active(task.assignee) ??
      (task.updateId
        ? (agents.find((agent) => agent.tools.includes('update_save_study'))
            ?.key ?? null)
        : null) ??
      active(task.project.agentKeys[0]) ??
      null
    );
  }

  private pickState(
    states: { id: string; key: string | null }[],
    input: TaskInput,
  ): string | undefined {
    if (input.stateId) {
      const state = states.find((item) => item.id === input.stateId);
      if (!state)
        throw new BadRequestException('Essa coluna não é deste projeto.');
      return state.id;
    }
    if (input.stateKey)
      return states.find((item) => item.key === input.stateKey)?.id;
    return undefined;
  }

  private async moduleIdsFor(
    project: { id: string; modules: { id: string; name: string }[] },
    input: TaskInput,
  ): Promise<string[]> {
    if (input.moduleIds) {
      return input.moduleIds.filter((id) =>
        project.modules.some((item) => item.id === id),
      );
    }
    const ids: string[] = [];
    for (const raw of input.moduleNames ?? []) {
      const name = raw.trim().slice(0, 80);
      if (!name) continue;
      const found = project.modules.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (found) {
        ids.push(found.id);
        continue;
      }
      const created = await this.prisma.boardModule.upsert({
        where: { projectId_name: { projectId: project.id, name } },
        create: {
          projectId: project.id,
          name,
          position: project.modules.length,
        },
        update: {},
      });
      project.modules.push(created);
      ids.push(created.id);
    }
    return [...new Set(ids)];
  }

  private async validProject(
    userId: string,
    input: ProjectInput,
    current: {
      id: string;
      name: string;
      identifier: string;
      description: string;
      agentKeys: string[];
      color: number;
    } | null,
  ) {
    const name = (input.name ?? current?.name ?? '').trim();
    if (!name || name.length > 80) {
      throw new BadRequestException(
        'O nome do projeto é obrigatório (até 80 caracteres).',
      );
    }
    const duplicate = await this.prisma.project.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        NOT: current ? { id: current.id } : undefined,
      },
      select: { name: true },
    });
    if (duplicate)
      throw new BadRequestException(`Já há um projeto "${duplicate.name}".`);
    const identifier = projectIdentifier(
      name,
      input.identifier ?? current?.identifier,
    );
    const taken = await this.prisma.project.findFirst({
      where: {
        userId,
        identifier,
        NOT: current ? { id: current.id } : undefined,
      },
      select: { name: true },
    });
    if (taken) {
      throw new BadRequestException(
        `O prefixo ${identifier} já é do projeto "${taken.name}": escolhe outro.`,
      );
    }
    const wanted = [
      ...new Set(
        (input.agentKeys ?? current?.agentKeys ?? [])
          .map((key) => key.trim())
          .filter(Boolean),
      ),
    ];
    const agents = wanted.length
      ? await this.prisma.agent.findMany({
          where: { userId, key: { in: wanted } },
          select: { key: true },
        })
      : [];
    return {
      name,
      identifier,
      description: (input.description ?? current?.description ?? '')
        .trim()
        .slice(0, 4000),
      agentKeys: agents.map((agent) => agent.key),
      color: input.color ?? current?.color ?? 0,
      serverConnectionId: await this.ownedServerId(
        userId,
        input.serverConnectionId,
      ),
    };
  }

  /** O servidor ligado a um projeto: tem de ser do utilizador (null tira-o). */
  private async ownedServerId(userId: string, id: string | null | undefined) {
    if (id === undefined) return undefined;
    if (!id) return null;
    const server = await this.prisma.serverConnection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!server) throw new NotFoundException('Esse servidor já não existe.');
    return server.id;
  }

  private async ownedTask(userId: string, id: string) {
    const task = await this.prisma.boardTask.findFirst({
      where: { id, userId },
    });
    if (!task) throw new NotFoundException('Esta tarefa já não existe.');
    return task;
  }

  private async ownedState(userId: string, id: string) {
    const state = await this.prisma.boardState.findFirst({
      where: { id, project: { userId } },
    });
    if (!state) throw new NotFoundException('Esta coluna já não existe.');
    return state;
  }

  private async ownedModule(userId: string, id: string) {
    const module = await this.prisma.boardModule.findFirst({
      where: { id, project: { userId } },
    });
    if (!module) throw new NotFoundException('Este módulo já não existe.');
    return module;
  }
}

const relatedView = (task: {
  id: string;
  number: number;
  title: string;
  state: { name: string; color: string; group: string };
  project: { identifier: string };
}) => ({
  id: task.id,
  key: taskKey(task.project.identifier, task.number),
  title: task.title,
  state: task.state,
});

const cleanLabels = (labels: string[]) =>
  [
    ...new Set(
      labels
        .map((label) =>
          label.trim().replace(/^#/, '').toLowerCase().slice(0, 30),
        )
        .filter(Boolean),
    ),
  ].slice(0, 12);

const sameDay = (a: Date | null, b: Date | null) =>
  (a?.toISOString().slice(0, 10) ?? null) ===
  (b?.toISOString().slice(0, 10) ?? null);
