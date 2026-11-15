import { randomUUID } from 'crypto';
import {
  TodoList,
  TodoSyncGroup,
  TodoSyncLink,
  TodoSyncScope,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { googleRemote } from './google/googleRemote';
import {
  bridgeName,
  GroupAccount,
  groupListNames,
  reconcileGroup,
} from './helpers/reconcileGroup';

jest.mock('./google/google-tasks.client', () => ({
  createTaskList: (_token: string, title: string) =>
    Promise.resolve({ id: `novo-${title}`, title }),
}));

let lists: TodoList[] = [];
let links: TodoSyncLink[] = [];

type Where = Record<string, unknown>;
const matches = (link: TodoSyncLink, where: Where) =>
  Object.entries(where).every(([field, value]) => {
    const own = link[field as keyof TodoSyncLink];
    if (value && typeof value === 'object' && 'notIn' in value)
      return !(value.notIn as unknown[]).includes(own);
    return own === value;
  });

const prisma = {
  todoList: {
    findMany: () => Promise.resolve([...lists]),
    create: ({
      data,
    }: {
      data: { userId: string; name: string; hidden?: boolean };
    }) => {
      const list = {
        id: randomUUID(),
        color: null,
        position: 0,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      lists.push(list);
      return Promise.resolve(list);
    },
    deleteMany: ({ where }: { where: { name: { startsWith: string } } }) => {
      lists = lists.filter(
        (list) =>
          !(
            list.hidden &&
            list.name.startsWith(where.name.startsWith) &&
            !links.some((link) => link.listId === list.id)
          ),
      );
      return Promise.resolve({ count: 0 });
    },
  },
  todoSyncItem: {
    deleteMany: () => Promise.resolve({ count: 0 }),
  },
  todoSyncLink: {
    findFirst: ({ where }: { where: Where }) =>
      Promise.resolve(links.find((link) => matches(link, where)) ?? null),
    create: ({
      data,
    }: {
      data: Omit<
        TodoSyncLink,
        'id' | 'lastSyncAt' | 'lastError' | 'createdAt' | 'updatedAt'
      >;
    }) => {
      const link = {
        id: randomUUID(),
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      links.push(link);
      return Promise.resolve(link);
    },
    update: ({
      where,
      data,
    }: {
      where: Where;
      data: Partial<TodoSyncLink>;
    }) => {
      links = links.map((link) =>
        link.id === where.id ? { ...link, ...data } : link,
      );
      return Promise.resolve(links.find((link) => link.id === where.id));
    },
    deleteMany: ({ where }: { where: Where }) => {
      const before = links.length;
      links = links.filter((link) => !matches(link, where));
      return Promise.resolve({ count: before - links.length });
    },
  },
} as unknown as PrismaService;

const group = (fields: Partial<TodoSyncGroup> = {}): TodoSyncGroup => ({
  id: 'grupo1',
  userId: 'u1',
  name: 'Casa',
  scope: TodoSyncScope.ALL,
  includeLocal: true,
  listNames: [],
  accountIds: ['a1', 'a2'],
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...fields,
});

const account = (id: string, titles: string[]): GroupAccount => ({
  id,
  label: `${id}@gmail.com`,
  remote: googleRemote('t'),
  lists: titles.map((title) => ({ id: `${id}-${title}`, title })),
});

beforeEach(() => {
  lists = [];
  links = [];
});

describe('groupListNames', () => {
  it('em "Tudo" junta as listas daqui e de todos os emails, sem repetir pelo nome', () => {
    const names = groupListNames(
      group(),
      ['Servidor', 'compras'],
      [account('a1', ['Compras', 'Casa']), account('a2', ['casa'])],
    );
    expect(names).toEqual(['Servidor', 'compras', 'Casa']);
  });

  it('em "Só estas listas" são só as escolhidas', () => {
    expect(
      groupListNames(
        group({ scope: TodoSyncScope.LISTS, listNames: ['Servidor'] }),
        ['Outra'],
        [account('a1', ['X'])],
      ),
    ).toEqual(['Servidor']);
  });
});

describe('reconcileGroup', () => {
  it('liga cada lista em cada email e cria o que falta dos dois lados', async () => {
    lists.push({
      id: 'l1',
      userId: 'u1',
      name: 'Servidor',
      color: null,
      position: 0,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const one = account('a1', ['Servidor']);
    const two = account('a2', ['Compras']);

    const problems = await reconcileGroup(prisma, group(), [one, two]);

    expect(problems).toEqual([]);
    expect(lists.map((list) => list.name).sort()).toEqual([
      'Compras',
      'Servidor',
    ]);
    expect(links).toHaveLength(4);
    expect(two.lists.map((list) => list.title).sort()).toEqual([
      'Compras',
      'Servidor',
    ]);
    expect(
      links.find(
        (link) => link.accountId === 'a2' && link.remoteListName === 'Servidor',
      )?.remoteListId,
    ).toBe('novo-Servidor');
  });

  it('uma segunda volta não cria nada de novo', async () => {
    const accounts = [account('a1', ['Servidor']), account('a2', ['Servidor'])];
    await reconcileGroup(prisma, group(), accounts);
    const before = links.map((link) => link.id).sort();
    await reconcileGroup(prisma, group(), accounts);
    expect(links.map((link) => link.id).sort()).toEqual(before);
    expect(lists).toHaveLength(1);
  });

  it('tirar uma lista de "Só estas listas" desfaz as ligações dela (e de mais nada)', async () => {
    const accounts = [account('a1', ['Servidor', 'Compras'])];
    await reconcileGroup(
      prisma,
      group({
        scope: TodoSyncScope.LISTS,
        listNames: ['Servidor', 'Compras'],
        accountIds: ['a1'],
      }),
      accounts,
    );
    expect(links).toHaveLength(2);
    await reconcileGroup(
      prisma,
      group({
        scope: TodoSyncScope.LISTS,
        listNames: ['Servidor'],
        accountIds: ['a1'],
      }),
      accounts,
    );
    expect(links.map((link) => link.remoteListName)).toEqual(['Servidor']);
  });

  it('a mesma lista com o mesmo email noutro grupo fica de fora, com aviso', async () => {
    const accounts = [account('a1', ['Servidor'])];
    await reconcileGroup(
      prisma,
      group({ id: 'outro', accountIds: ['a1'] }),
      accounts,
    );
    const problems = await reconcileGroup(
      prisma,
      group({ accountIds: ['a1'] }),
      accounts,
    );
    expect(problems).toHaveLength(1);
    expect(links.filter((link) => link.groupId === 'grupo1')).toHaveLength(0);
  });

  it('um email que não respondeu guarda as ligações que tinha', async () => {
    const accounts = [account('a1', ['Servidor']), account('a2', ['Servidor'])];
    await reconcileGroup(prisma, group(), accounts);
    await reconcileGroup(prisma, group(), [accounts[0]], ['a2']);
    expect(links.filter((link) => link.accountId === 'a2')).toHaveLength(1);
  });

  it('uma lista apagada no Google volta a ser criada e o par passa para a nova', async () => {
    const first = [account('a1', ['Servidor'])];
    await reconcileGroup(prisma, group({ accountIds: ['a1'] }), first);
    const id = links[0].id;
    await reconcileGroup(prisma, group({ accountIds: ['a1'] }), [
      account('a1', []),
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(id);
    expect(links[0].remoteListId).toBe('novo-Servidor');
  });

  it('sem o servidor, os emails ligam-se por uma lista escondida e as Tarefas ficam de fora', async () => {
    lists.push({
      id: 'l1',
      userId: 'u1',
      name: 'Servidor',
      color: null,
      position: 0,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const accounts = [account('a1', ['Compras']), account('a2', ['Compras'])];

    await reconcileGroup(prisma, group({ includeLocal: false }), accounts);

    expect(links).toHaveLength(2);
    const bridge = lists.find((list) => list.id === links[0].listId)!;
    expect(bridge.hidden).toBe(true);
    expect(bridge.name).toBe(bridgeName('grupo1', 'Compras'));
    expect(links.every((link) => link.listId === bridge.id)).toBe(true);
    expect(links.some((link) => link.listId === 'l1')).toBe(false);
    expect(accounts[0].lists.map((list) => list.title)).toEqual(['Compras']);
  });
});
