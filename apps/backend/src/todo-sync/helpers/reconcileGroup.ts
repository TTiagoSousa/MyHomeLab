import { PrismaService } from 'src/prisma/prisma.service';
import {
  TodoSyncGroup,
  TodoSyncScope,
} from 'src/generated/prisma/client/client';
import { RemoteTaskList, TaskRemote } from '../remote/taskRemote';

/** Uma conta do grupo (um email do Google, um Nextcloud), com as listas que tem lá. */
export interface GroupAccount {
  id: string;
  /** Como aparece nos avisos: o email, ou o utilizador e o Nextcloud. */
  label: string;
  remote: TaskRemote;
  lists: RemoteTaskList[];
}

const key = (name: string) => name.trim().toLowerCase();

/** O nome interno da lista escondida que liga as contas de um grupo sem o servidor. */
export const bridgeName = (groupId: string, name: string) =>
  `__sync:${groupId}:${key(name)}`.slice(0, 120);

/** Os nomes das listas que o grupo sincroniza (sem repetir maiúsculas/minúsculas). */
export function groupListNames(
  group: Pick<TodoSyncGroup, 'scope' | 'listNames'>,
  localNames: string[],
  accounts: GroupAccount[],
): string[] {
  const all =
    group.scope === TodoSyncScope.ALL
      ? [
          ...localNames,
          ...accounts.flatMap((account) =>
            account.lists.map((list) => list.title),
          ),
        ]
      : group.listNames;
  const seen = new Map<string, string>();
  for (const name of all) {
    const clean = name.trim().slice(0, 60);
    if (clean && !seen.has(key(clean))) seen.set(key(clean), clean);
  }
  return [...seen.values()];
}

/**
 * Faz as ligações de um grupo a partir das contas e do que sincroniza: cada lista, pelo
 * nome, fica ligada nas Tarefas e em cada conta (criada onde faltar). Sem o servidor no
 * grupo, as Tarefas não entram: as contas ligam-se por uma lista escondida, só deste
 * grupo, que não aparece em lado nenhum. As ligações que já não fazem parte saem (as
 * tarefas ficam). O que não dá para ligar porque já está noutro grupo com a mesma conta
 * volta como aviso.
 */
export async function reconcileGroup(
  prisma: PrismaService,
  group: TodoSyncGroup,
  accounts: GroupAccount[],
  /** As contas que não se conseguiram ler agora: as ligações delas ficam como estão. */
  unreachable: string[] = [],
): Promise<string[]> {
  const problems: string[] = [];
  const locals = await prisma.todoList.findMany({
    where: { userId: group.userId },
  });
  const visible = locals.filter((list) => !list.hidden);
  const names = groupListNames(
    group,
    group.scope === TodoSyncScope.ALL && group.includeLocal
      ? visible.map((list) => list.name)
      : [],
    accounts,
  );
  const wanted = new Set<string>();
  const localFor = (name: string) =>
    group.includeLocal
      ? visible.find((list) => key(list.name) === key(name))
      : locals.find((list) => list.name === bridgeName(group.id, name));

  for (const name of names) {
    let local = localFor(name);
    for (const account of accounts) {
      const existing = local
        ? await prisma.todoSyncLink.findFirst({
            where: { accountId: account.id, listId: local.id },
          })
        : null;
      if (existing && existing.groupId !== group.id) {
        problems.push(`«${name}» de ${account.label} já está noutro grupo`);
        continue;
      }
      let remote = account.lists.find((list) => key(list.title) === key(name));
      if (remote) {
        const taken = await prisma.todoSyncLink.findFirst({
          where: { accountId: account.id, remoteListId: remote.id },
        });
        if (taken && taken.groupId !== group.id) {
          problems.push(`«${name}» de ${account.label} já está noutro grupo`);
          continue;
        }
      }
      if (!local) {
        local = await prisma.todoList.create({
          data: group.includeLocal
            ? { userId: group.userId, name }
            : {
                userId: group.userId,
                name: bridgeName(group.id, name),
                hidden: true,
              },
        });
        locals.push(local);
        if (!local.hidden) visible.push(local);
      }
      if (!remote) {
        remote = await account.remote.createList(name);
        account.lists.push(remote);
      }
      // A lista de lá mudou (apagada lá e criada outra vez, ou outra com este nome):
      // o par passa para ela e recomeça (a primeira volta junta pelo título).
      if (existing && existing.remoteListId !== remote.id) {
        const other = await prisma.todoSyncLink.findFirst({
          where: { accountId: account.id, remoteListId: remote.id },
        });
        if (!other) {
          await prisma.todoSyncItem.deleteMany({
            where: { linkId: existing.id },
          });
          await prisma.todoSyncLink.update({
            where: { id: existing.id },
            data: {
              remoteListId: remote.id,
              remoteListName: remote.title,
              lastSyncAt: null,
              lastError: null,
            },
          });
        }
      }
      const link =
        existing ??
        (await prisma.todoSyncLink.findFirst({
          where: { accountId: account.id, remoteListId: remote.id },
        })) ??
        (await prisma.todoSyncLink.create({
          data: {
            userId: group.userId,
            groupId: group.id,
            listId: local.id,
            accountId: account.id,
            remoteListId: remote.id,
            remoteListName: remote.title,
          },
        }));
      wanted.add(link.id);
    }
  }

  await prisma.todoSyncLink.deleteMany({
    where: {
      groupId: group.id,
      id: { notIn: [...wanted] },
      accountId: { notIn: unreachable },
    },
  });
  // As listas escondidas deste grupo que já não ligam nada saem (são só a ponte).
  await prisma.todoList.deleteMany({
    where: {
      userId: group.userId,
      hidden: true,
      name: { startsWith: `__sync:${group.id}:` },
      syncLinks: { none: {} },
    },
  });
  return problems;
}
