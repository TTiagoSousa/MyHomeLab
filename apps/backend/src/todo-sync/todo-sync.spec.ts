import { randomUUID } from 'crypto';
import {
  Todo,
  TodoStatus,
  TodoSyncItem,
  TodoSyncLink,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleTask, GoogleTaskInput } from './google/google-tasks.client';
import { remoteToTodo, todoDueDay, todoToRemote } from './helpers/taskFields';
import { syncLink } from './helpers/syncLink';
import { googleRemote } from './google/googleRemote';

// ── Um Google Tasks a fingir: uma lista em memória, com o relógio a andar ──
let clock = Date.parse('2026-11-08T10:00:00Z');
const tick = () => new Date((clock += 1000));
const google = new Map<string, GoogleTask>();

const fromInput = (
  id: string,
  input: GoogleTaskInput,
  parent: string | null,
): GoogleTask => ({
  id,
  title: input.title,
  notes: input.notes,
  dueDay: input.dueDay,
  completed: input.completed,
  completedAt: input.completed ? new Date(clock) : null,
  parent,
  updated: tick(),
});

jest.mock('./google/google-tasks.client', () => ({
  listTasks: () => Promise.resolve([...google.values()]),
  insertTask: (
    _t: string,
    _l: string,
    input: GoogleTaskInput,
    parent?: string,
  ) => {
    const task = fromInput(
      `g${google.size + 1}-${randomUUID().slice(0, 4)}`,
      input,
      parent ?? null,
    );
    google.set(task.id, task);
    return Promise.resolve(task);
  },
  patchTask: (_t: string, _l: string, id: string, input: GoogleTaskInput) => {
    const task = fromInput(id, input, google.get(id)?.parent ?? null);
    google.set(id, task);
    return Promise.resolve(task);
  },
  deleteTask: (_t: string, _l: string, id: string) => {
    google.delete(id);
    return Promise.resolve();
  },
}));

// ── Uma base de dados a fingir: só o que a sincronização usa ──
let todos: Todo[] = [];
let items: TodoSyncItem[] = [];

const newTodo = (fields: Partial<Todo>): Todo => ({
  id: randomUUID(),
  userId: 'u1',
  listId: 'l1',
  parentId: null,
  title: 'x',
  notes: null,
  dueAt: null,
  dueAllDay: false,
  priority: null,
  status: TodoStatus.OPEN,
  completedAt: null,
  links: [],
  agentName: null,
  subject: null,
  createdAt: tick(),
  updatedAt: new Date(clock),
  ...fields,
});

const removeTodo = (id: string) => {
  const gone = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const todo of todos)
      if (todo.parentId && gone.has(todo.parentId) && !gone.has(todo.id)) {
        gone.add(todo.id);
        grew = true;
      }
  }
  todos = todos.filter((todo) => !gone.has(todo.id));
  items = items.map((item) =>
    item.todoId && gone.has(item.todoId) ? { ...item, todoId: null } : item,
  );
};

type Where = Record<string, string>;
const prisma = {
  todoSyncItem: {
    findMany: ({ where, include }: { where: Where; include?: object }) =>
      Promise.resolve(
        items
          .filter((item) => item.linkId === where.linkId)
          .map((item) =>
            include
              ? {
                  ...item,
                  todo: todos.find((todo) => todo.id === item.todoId) ?? null,
                }
              : item,
          ),
      ),
    create: ({ data }: { data: Omit<TodoSyncItem, 'id'> }) => {
      const item = { id: randomUUID(), ...data };
      items.push(item);
      return Promise.resolve(item);
    },
    update: ({
      where,
      data,
    }: {
      where: Where;
      data: Partial<TodoSyncItem>;
    }) => {
      items = items.map((item) =>
        item.id === where.id ? { ...item, ...data } : item,
      );
      return Promise.resolve(items.find((item) => item.id === where.id));
    },
    delete: ({ where }: { where: Where }) => {
      items = items.filter((item) => item.id !== where.id);
      return Promise.resolve();
    },
    deleteMany: ({ where }: { where: Where }) => {
      items = items.filter((item) => item.id !== where.id);
      return Promise.resolve({ count: 1 });
    },
  },
  todo: {
    findMany: ({ where }: { where: Where }) =>
      Promise.resolve(todos.filter((todo) => todo.listId === where.listId)),
    findUnique: ({ where }: { where: Where }) =>
      Promise.resolve(todos.find((todo) => todo.id === where.id) ?? null),
    create: ({ data }: { data: Partial<Todo> }) => {
      const todo = newTodo(data);
      todos.push(todo);
      return Promise.resolve(todo);
    },
    update: ({ where, data }: { where: Where; data: Partial<Todo> }) => {
      todos = todos.map((todo) =>
        todo.id === where.id ? { ...todo, ...data, updatedAt: tick() } : todo,
      );
      return Promise.resolve(todos.find((todo) => todo.id === where.id));
    },
    deleteMany: ({ where }: { where: Where }) => {
      removeTodo(where.id);
      return Promise.resolve({ count: 1 });
    },
  },
} as unknown as PrismaService;

const link = {
  id: 'k1',
  userId: 'u1',
  listId: 'l1',
  remoteListId: 'r1',
  lastSyncAt: null,
} as TodoSyncLink;
const run = (first = false) =>
  syncLink(
    prisma,
    { ...link, lastSyncAt: first ? null : new Date() },
    googleRemote('t'),
  );
const editHere = (id: string, data: Partial<Todo>) => {
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, ...data, updatedAt: tick() } : todo,
  );
};
const editThere = (id: string, data: Partial<GoogleTask>) => {
  google.set(id, { ...google.get(id)!, ...data, updated: tick() });
};
const remoteOf = (todoId: string) =>
  items.find((item) => item.todoId === todoId)!.remoteId;

beforeEach(() => {
  google.clear();
  todos = [];
  items = [];
});

describe('campos', () => {
  it('o prazo de dia inteiro vai como o próprio dia; com hora, o dia em Portugal', () => {
    expect(
      todoDueDay({ dueAt: new Date('2026-11-09T00:00:00Z'), dueAllDay: true }),
    ).toBe('2026-11-09');
    expect(
      todoDueDay({ dueAt: new Date('2026-11-09T23:30:00Z'), dueAllDay: false }),
    ).toBe('2026-11-09');
    expect(
      todoDueDay({ dueAt: new Date('2026-07-09T23:30:00Z'), dueAllDay: false }),
    ).toBe('2026-07-10');
  });

  it('feita e cancelada vão como concluídas', () => {
    expect(
      todoToRemote(newTodo({ status: TodoStatus.CANCELLED })).completed,
    ).toBe(true);
    expect(
      todoToRemote(newTodo({ status: TodoStatus.IN_PROGRESS })).completed,
    ).toBe(false);
  });

  it('o que o Google não tem fica: a hora do prazo no mesmo dia e "a andar"', () => {
    const current = newTodo({
      dueAt: new Date('2026-11-09T15:00:00Z'),
      status: TodoStatus.IN_PROGRESS,
    });
    const data = remoteToTodo(
      {
        id: 'g',
        title: 'x',
        notes: null,
        dueDay: '2026-11-09',
        completed: false,
        completedAt: null,
        parent: null,
        updated: new Date(),
      },
      current,
    );
    expect(data.dueAt).toEqual(current.dueAt);
    expect(data.status).toBe(TodoStatus.IN_PROGRESS);
  });
});

describe('syncLink', () => {
  it('na primeira volta junta as iguais pelo título e copia as outras para os dois lados', async () => {
    todos.push(
      newTodo({ title: 'Comprar leite' }),
      newTodo({ title: 'Só aqui' }),
    );
    google.set(
      'g1',
      fromInput(
        'g1',
        { title: 'comprar leite', notes: null, dueDay: null, completed: false },
        null,
      ),
    );
    google.set(
      'g2',
      fromInput(
        'g2',
        { title: 'Só no Google', notes: null, dueDay: null, completed: false },
        null,
      ),
    );

    const counts = await run(true);

    expect(counts.created).toBe(2);
    expect(todos.map((todo) => todo.title).sort()).toEqual([
      'Comprar leite',
      'Só aqui',
      'Só no Google',
    ]);
    expect([...google.values()].map((task) => task.title).sort()).toEqual([
      'Só aqui',
      'Só no Google',
      'comprar leite',
    ]);
    expect(items).toHaveLength(3);
  });

  it('uma volta sem mudanças não escreve nada (sem ping-pong)', async () => {
    todos.push(newTodo({ title: 'A' }));
    await run(true);
    expect(await run()).toEqual({ created: 0, updated: 0, deleted: 0 });
  });

  it('a mudança de um só lado passa para o outro', async () => {
    const todo = newTodo({ title: 'A' });
    todos.push(todo);
    await run(true);

    editHere(todo.id, { status: TodoStatus.DONE });
    await run();
    expect(google.get(remoteOf(todo.id))!.completed).toBe(true);

    editThere(remoteOf(todo.id), { title: 'A no telemóvel' });
    await run();
    expect(todos[0].title).toBe('A no telemóvel');
  });

  it('mudou dos dois lados: ganha a mais recente', async () => {
    const todo = newTodo({ title: 'A' });
    todos.push(todo);
    await run(true);

    editHere(todo.id, { title: 'aqui (antes)' });
    editThere(remoteOf(todo.id), { title: 'Google (depois)' });
    await run();
    expect(todos[0].title).toBe('Google (depois)');

    editThere(remoteOf(todo.id), { title: 'Google (antes)' });
    editHere(todo.id, { title: 'aqui (depois)' });
    await run();
    expect(google.get(remoteOf(todo.id))!.title).toBe('aqui (depois)');
  });

  it('apagar de um lado apaga do outro', async () => {
    const one = newTodo({ title: 'Apaga aqui' });
    const two = newTodo({ title: 'Apaga no Google' });
    todos.push(one, two);
    await run(true);
    const twoRemote = remoteOf(two.id);

    removeTodo(one.id);
    google.delete(twoRemote);
    const counts = await run();

    expect(counts.deleted).toBe(2);
    expect(todos).toHaveLength(0);
    expect(google.size).toBe(0);
    expect(items).toHaveLength(0);
  });

  it('as sub-tarefas vão com a mãe para o Google', async () => {
    const parent = newTodo({ title: 'Mãe' });
    todos.push(newTodo({ title: 'Filha', parentId: parent.id }), parent);
    await run(true);
    const child = todos.find((todo) => todo.title === 'Filha')!;
    expect(google.get(remoteOf(child.id))!.parent).toBe(remoteOf(parent.id));
  });

  it('uma tarefa que muda de lista sai do Google desta lista', async () => {
    const todo = newTodo({ title: 'Vai embora' });
    todos.push(todo);
    await run(true);
    editHere(todo.id, { listId: 'l2' });
    await run();
    expect(google.size).toBe(0);
    expect(todos).toHaveLength(1);
  });
});

describe('sub-tarefas a vários níveis', () => {
  it('a neta entra no Google depois da filha, mesmo criada antes', async () => {
    const mother = newTodo({ title: 'Mãe' });
    const daughter = newTodo({ title: 'Filha', parentId: mother.id });
    const granddaughter = newTodo({ title: 'Neta', parentId: daughter.id });
    todos.push(granddaughter, daughter, mother);
    await run(true);
    expect(google.get(remoteOf(granddaughter.id))!.parent).toBe(
      remoteOf(daughter.id),
    );
  });
});
