import { PrismaService } from 'src/prisma/prisma.service';
import { Todo, TodoSyncLink } from 'src/generated/prisma/client/client';
import { RemoteTask, TaskRemote } from '../remote/taskRemote';
import { remoteToTodo, todoToRemote } from './taskFields';

export interface SyncCounts {
  created: number;
  updated: number;
  deleted: number;
}

/** Por níveis: cada mãe antes das filhas, a qualquer profundidade (dentro das novas). */
const parentsFirst = <T extends { id: string }>(
  items: T[],
  parentOf: (item: T) => string | null,
) => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const depth = (item: T) => {
    let level = 0;
    const seen = new Set<string>();
    for (
      let parent = parentOf(item);
      parent && byId.has(parent) && !seen.has(parent);
      parent = parentOf(byId.get(parent)!)
    ) {
      seen.add(parent);
      level++;
    }
    return level;
  };
  return [...items].sort((a, b) => depth(a) - depth(b));
};

const sameTask = (todo: Todo, task: RemoteTask) =>
  todo.title.trim().toLowerCase() === task.title.trim().toLowerCase();

/**
 * Uma volta de sincronização de uma lista com a sua lista lá (Google Tasks, Nextcloud),
 * nos dois sentidos. Quem mudou desde a última volta vê-se pelas datas guardadas em cada par;
 * se mudaram os dois lados, ganha a alteração mais recente. Apagar de um lado apaga do
 * outro; uma tarefa que muda de lista sai da lista de lá desta e entra na da outra.
 */
export async function syncLink(
  prisma: PrismaService,
  link: TodoSyncLink,
  remoteTasks: TaskRemote,
): Promise<SyncCounts> {
  const counts: SyncCounts = { created: 0, updated: 0, deleted: 0 };
  const remote = await remoteTasks.listTasks(link.remoteListId);
  const remoteById = new Map(remote.map((task) => [task.id, task]));
  const items = await prisma.todoSyncItem.findMany({
    where: { linkId: link.id },
    include: { todo: true },
  });
  const goneHere = new Set<string>();

  // ── Os pares que já existem ──
  for (const item of items) {
    const task = remoteById.get(item.remoteId);
    // Uma sub-tarefa de uma que acabou de ser apagada aqui já não existe (cascata).
    const todo =
      item.todo && goneHere.size
        ? await prisma.todo.findUnique({ where: { id: item.todo.id } })
        : item.todo;
    if (!todo || todo.listId !== link.listId) {
      if (task) await remoteTasks.deleteTask(link.remoteListId, item.remoteId);
      // Já não está lá: não pode voltar a entrar mais abaixo como "nova de lá".
      remoteById.delete(item.remoteId);
      await prisma.todoSyncItem.delete({ where: { id: item.id } });
      counts.deleted++;
      continue;
    }
    if (!task) {
      // Apagada lá. As sub-tarefas vão com ela (cascata) e os pares delas ficam
      // sem tarefa daqui: na volta seguinte saem de lá, se ainda lá estiverem.
      goneHere.add(todo.id);
      await prisma.todo.deleteMany({ where: { id: todo.id } });
      await prisma.todoSyncItem.deleteMany({ where: { id: item.id } });
      counts.deleted++;
      continue;
    }
    const changedHere = todo.updatedAt > item.localUpdatedAt;
    const changedThere = task.updated > item.remoteUpdatedAt;
    if (!changedHere && !changedThere) continue;
    if (changedHere && (!changedThere || todo.updatedAt >= task.updated)) {
      const saved = await remoteTasks.patchTask(
        link.remoteListId,
        task.id,
        todoToRemote(todo),
      );
      await prisma.todoSyncItem.update({
        where: { id: item.id },
        data: {
          localUpdatedAt: todo.updatedAt,
          remoteUpdatedAt: saved.updated,
        },
      });
    } else {
      const exists = await prisma.todo.findUnique({ where: { id: todo.id } });
      if (!exists) continue;
      const saved = await prisma.todo.update({
        where: { id: todo.id },
        data: remoteToTodo(task, exists),
      });
      await prisma.todoSyncItem.update({
        where: { id: item.id },
        data: {
          localUpdatedAt: saved.updatedAt,
          remoteUpdatedAt: task.updated,
        },
      });
    }
    counts.updated++;
  }

  const paired = await prisma.todoSyncItem.findMany({
    where: { linkId: link.id },
  });
  const remoteOfTodo = new Map(
    paired
      .filter((item) => item.todoId)
      .map((item) => [item.todoId!, item.remoteId]),
  );
  const todoOfRemote = new Map(
    paired
      .filter((item) => item.todoId)
      .map((item) => [item.remoteId, item.todoId!]),
  );

  const localNew = (
    await prisma.todo.findMany({
      where: { listId: link.listId },
      orderBy: { createdAt: 'asc' },
    })
  ).filter((todo) => !remoteOfTodo.has(todo.id) && !goneHere.has(todo.id));
  const remoteNew = [...remoteById.values()].filter(
    (task) => !todoOfRemote.has(task.id),
  );

  // Na primeira volta, a mesma tarefa pode já existir dos dois lados: junta-as pelo
  // título em vez de as duplicar.
  if (!link.lastSyncAt) {
    for (const todo of [...localNew]) {
      const match = remoteNew.find((task) => sameTask(todo, task));
      if (!match) continue;
      await prisma.todoSyncItem.create({
        data: {
          linkId: link.id,
          todoId: todo.id,
          remoteId: match.id,
          localUpdatedAt: todo.updatedAt,
          remoteUpdatedAt: match.updated,
        },
      });
      remoteOfTodo.set(todo.id, match.id);
      todoOfRemote.set(match.id, todo.id);
      localNew.splice(localNew.indexOf(todo), 1);
      remoteNew.splice(remoteNew.indexOf(match), 1);
    }
  }

  // ── As novas daqui vão para lá (as mães primeiro, para as filhas terem onde ficar) ──
  for (const todo of parentsFirst(localNew, (item) => item.parentId)) {
    const parent = todo.parentId ? remoteOfTodo.get(todo.parentId) : undefined;
    const saved = await remoteTasks.insertTask(
      link.remoteListId,
      todoToRemote(todo),
      parent,
    );
    await prisma.todoSyncItem.create({
      data: {
        linkId: link.id,
        todoId: todo.id,
        remoteId: saved.id,
        localUpdatedAt: todo.updatedAt,
        remoteUpdatedAt: saved.updated,
      },
    });
    remoteOfTodo.set(todo.id, saved.id);
    counts.created++;
  }

  // ── As novas de lá vêm para aqui ──
  for (const task of parentsFirst(remoteNew, (item) => item.parent)) {
    const created = await prisma.todo.create({
      data: {
        userId: link.userId,
        listId: link.listId,
        parentId: task.parent ? (todoOfRemote.get(task.parent) ?? null) : null,
        ...remoteToTodo(task),
      },
    });
    await prisma.todoSyncItem.create({
      data: {
        linkId: link.id,
        todoId: created.id,
        remoteId: task.id,
        localUpdatedAt: created.updatedAt,
        remoteUpdatedAt: task.updated,
      },
    });
    todoOfRemote.set(task.id, created.id);
    counts.created++;
  }

  return counts;
}
