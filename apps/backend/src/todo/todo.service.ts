import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TodoPriority,
  TodoStatus,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateTodoDto,
  CreateTodoListDto,
  ListTodosQueryDto,
  UpdateTodoDto,
  UpdateTodoListDto,
} from './dto/todo.dto';
import { normalizeName } from './helpers/normalizeName';
import { statusChange } from './helpers/statusChange';

/** A lista que se cria quando ele ainda não tem nenhuma. */
const FIRST_LIST = 'Pessoal';

/** Quantas feitas se mostram (as por fazer vêm todas). */
const MAX_DONE = 200;

const OPEN_STATUSES: TodoStatus[] = [TodoStatus.OPEN, TodoStatus.IN_PROGRESS];

/** Uma tarefa que o código abre e fecha sozinho (ex.: responder a uma atualização). */
export interface SubjectTodo {
  list: string;
  title: string;
  notes?: string | null;
  dueAt?: Date | null;
  dueAllDay?: boolean;
  priority?: TodoPriority | null;
  links?: string[];
  agentName?: string | null;
}

/** As tarefas do utilizador (os afazeres), com listas, prazos e sub-tarefas. */
@Injectable()
export class TodoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listas ──────────────────────────────────────────────────────────────

  async lists(userId: string) {
    const existing = await this.prisma.todoList.count({
      where: { userId, hidden: false },
    });
    if (!existing) {
      await this.prisma.todoList.create({
        data: { userId, name: FIRST_LIST },
      });
    }
    // As escondidas (pontes da sincronização entre emails) não aparecem nas Tarefas.
    const lists = await this.prisma.todoList.findMany({
      where: { userId, hidden: false },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { todos: { where: { status: { in: OPEN_STATUSES } } } },
        },
      },
    });
    return lists.map(({ _count, ...list }) => ({
      ...list,
      openCount: _count.todos,
    }));
  }

  async createList(userId: string, input: CreateTodoListDto) {
    const name = cleanName(input.name);
    await this.assertFreeName(userId, name);
    const position = await this.prisma.todoList.count({
      where: { userId, hidden: false },
    });
    return this.prisma.todoList.create({
      data: { userId, name, color: input.color ?? null, position },
    });
  }

  async updateList(userId: string, id: string, input: UpdateTodoListDto) {
    await this.ownList(userId, id);
    const name = input.name === undefined ? undefined : cleanName(input.name);
    if (name) await this.assertFreeName(userId, name, id);
    return this.prisma.todoList.update({
      where: { id },
      data: { name, color: input.color, position: input.position },
    });
  }

  async deleteList(userId: string, id: string) {
    await this.ownList(userId, id);
    await this.prisma.todoList.delete({ where: { id } });
  }

  /** A lista pelo nome (sem maiúsculas nem acentos), criada se não existir. */
  async ensureList(userId: string, name: string) {
    const wanted = normalizeName(name);
    const lists = await this.prisma.todoList.findMany({
      where: { userId, hidden: false },
    });
    const found = lists.find((list) => normalizeName(list.name) === wanted);
    if (found) return found;
    return this.prisma.todoList.create({
      data: { userId, name: cleanName(name), position: lists.length },
    });
  }

  // ── Tarefas ─────────────────────────────────────────────────────────────

  async list(userId: string, query: ListTodosQueryDto = {}) {
    const status = query.status ?? 'all';
    const where: Prisma.TodoWhereInput = {
      userId,
      list: { hidden: false },
      ...(query.listId ? { listId: query.listId } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { notes: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const open =
      status === 'done'
        ? []
        : await this.prisma.todo.findMany({
            where: { ...where, status: { in: OPEN_STATUSES } },
            orderBy: [
              { dueAt: { sort: 'asc', nulls: 'last' } },
              { createdAt: 'asc' },
            ],
          });
    const done =
      status === 'open'
        ? []
        : await this.prisma.todo.findMany({
            where: { ...where, status: { notIn: OPEN_STATUSES } },
            orderBy: { completedAt: { sort: 'desc', nulls: 'last' } },
            take: MAX_DONE,
          });
    return [...open, ...done];
  }

  async get(userId: string, id: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, userId } });
    if (!todo) throw new NotFoundException('Tarefa não encontrada.');
    return todo;
  }

  async create(userId: string, input: CreateTodoDto, agentName?: string) {
    await this.ownList(userId, input.listId);
    const parent = input.parentId
      ? await this.get(userId, input.parentId)
      : null;
    return this.prisma.todo.create({
      data: {
        userId,
        listId: parent?.listId ?? input.listId,
        parentId: parent?.id ?? null,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        dueAllDay: Boolean(input.dueAt && input.dueAllDay),
        priority: input.priority ?? null,
        links: cleanLinks(input.links),
        agentName: agentName ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateTodoDto) {
    const todo = await this.get(userId, id);
    if (input.listId && input.listId !== todo.listId) {
      await this.ownList(userId, input.listId);
      await this.prisma.todo.updateMany({
        where: { userId, id: { in: await this.descendantIds(userId, id) } },
        data: { listId: input.listId },
      });
    }
    return this.prisma.todo.update({
      where: { id },
      data: {
        listId: input.listId,
        // Uma sub-tarefa que muda de lista deixa de ser sub-tarefa.
        ...(input.listId && input.listId !== todo.listId && todo.parentId
          ? { parentId: null }
          : {}),
        title: input.title?.trim(),
        notes:
          input.notes === undefined ? undefined : input.notes?.trim() || null,
        ...(input.dueAt === undefined
          ? input.dueAllDay === undefined || !todo.dueAt
            ? {}
            : { dueAllDay: input.dueAllDay }
          : {
              dueAt: input.dueAt ? new Date(input.dueAt) : null,
              dueAllDay: Boolean(input.dueAt && input.dueAllDay),
            }),
        priority: input.priority,
        links: input.links === undefined ? undefined : cleanLinks(input.links),
        ...statusChange(todo.status, input.status),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.todo.delete({ where: { id } });
  }

  // ── As que o código gere sozinho ────────────────────────────────────────

  /**
   * Abre (ou atualiza) a tarefa de um assunto, na lista dita. Se já estava feita,
   * volta a ficar por fazer; se ele a mudou de lista, fica onde ele a pôs.
   */
  async openSubject(userId: string, subject: string, input: SubjectTodo) {
    const list = await this.ensureList(userId, input.list);
    const data = {
      title: input.title,
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
      dueAllDay: Boolean(input.dueAt && input.dueAllDay),
      priority: input.priority ?? null,
      links: cleanLinks(input.links),
      agentName: input.agentName ?? null,
      status: TodoStatus.OPEN,
      completedAt: null,
    };
    return this.prisma.todo.upsert({
      where: { userId_subject: { userId, subject } },
      create: { userId, subject, listId: list.id, ...data },
      update: data,
    });
  }

  /** Dá como feita a tarefa de um assunto (se houver e ainda estiver por fazer). */
  async closeSubject(userId: string, subject: string, note?: string) {
    const todo = await this.prisma.todo.findUnique({
      where: { userId_subject: { userId, subject } },
    });
    if (!todo || !OPEN_STATUSES.includes(todo.status)) return null;
    return this.prisma.todo.update({
      where: { id: todo.id },
      data: {
        status: TodoStatus.DONE,
        completedAt: new Date(),
        ...(note
          ? { notes: [todo.notes, note].filter(Boolean).join('\n\n') }
          : {}),
      },
    });
  }

  // ── Apoio ───────────────────────────────────────────────────────────────

  /** As sub-tarefas de uma tarefa, a todos os níveis. */
  private async descendantIds(userId: string, id: string) {
    const ids: string[] = [];
    let parents = [id];
    while (parents.length) {
      const children = await this.prisma.todo.findMany({
        where: { userId, parentId: { in: parents } },
        select: { id: true },
      });
      parents = children
        .map((child) => child.id)
        .filter((child) => !ids.includes(child));
      ids.push(...parents);
    }
    return ids;
  }

  private async ownList(userId: string, id: string) {
    const list = await this.prisma.todoList.findFirst({
      where: { id, userId, hidden: false },
    });
    if (!list) throw new NotFoundException('Lista não encontrada.');
    return list;
  }

  private async assertFreeName(
    userId: string,
    name: string,
    exceptId?: string,
  ) {
    const wanted = normalizeName(name);
    const lists = await this.prisma.todoList.findMany({
      where: { userId, hidden: false },
    });
    if (
      lists.some(
        (list) => list.id !== exceptId && normalizeName(list.name) === wanted,
      )
    ) {
      throw new ConflictException(`Já existe a lista "${name}".`);
    }
  }
}

/** Sem espaços à volta, vazios nem repetidos. */
const cleanLinks = (links: string[] = []) => [
  ...new Set(links.map((link) => link.trim()).filter(Boolean)),
];

const cleanName = (name: string) => {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new BadRequestException('Falta o nome da lista.');
  return clean;
};
