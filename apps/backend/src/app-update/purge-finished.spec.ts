import { AppUpdateStatus } from 'src/generated/prisma/client/client';
import { AppUpdateService } from './app-update.service';

const finished = [
  {
    id: 'u1',
    status: AppUpdateStatus.DONE,
    boardTaskId: 't1',
    boardTaskKey: 'ATU-1',
    logDocId: 'd1',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    accountId: 'a1',
    hostServerId: null,
    componentTitle: null,
    hostPackages: null,
    account: { provider: 'IMMICH', displayName: 'Immich' },
    hostServer: null,
  },
  {
    id: 'u2',
    status: AppUpdateStatus.CANCELLED,
    boardTaskId: null,
    boardTaskKey: null,
    logDocId: 'd2',
    fromVersion: '1.1.0',
    toVersion: '1.2.0',
    accountId: 'a1',
    hostServerId: null,
    componentTitle: null,
    hostPackages: null,
    account: { provider: 'IMMICH', displayName: 'Immich' },
    hostServer: null,
  },
];

const build = () => {
  const prisma = {
    appUpdate: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(finished)
        .mockResolvedValueOnce([{ logDocId: 'd2' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    doc: {
      findMany: jest.fn().mockResolvedValue([{ id: 'd1', title: 'Estudo' }]),
    },
  };
  const docs = { remove: jest.fn().mockResolvedValue(undefined) };
  const board = { removeTask: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    resolveUserSubjectPrefixes: jest.fn().mockResolvedValue(undefined),
  };
  const updates = new AppUpdateService(
    prisma as never,
    docs as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
    board as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { updates, prisma, docs, board, notifications };
};

describe('purgeFinished', () => {
  it('sem apply só diz o que se apagava', async () => {
    const { updates, prisma, docs, board } = build();
    const result = await updates.purgeFinished('user', false);
    expect(result.updates).toHaveLength(2);
    expect(result.tasks).toBe(1);
    expect(result.docs).toEqual(['Estudo']);
    expect(prisma.appUpdate.deleteMany).not.toHaveBeenCalled();
    expect(board.removeTask).not.toHaveBeenCalled();
    expect(docs.remove).not.toHaveBeenCalled();
  });

  it('apaga as atualizações, as tarefas e só os registos que não são partilhados', async () => {
    const { updates, prisma, docs, board, notifications } = build();
    await updates.purgeFinished('user', true);
    expect(prisma.appUpdate.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
    });
    expect(board.removeTask).toHaveBeenCalledWith('user', 't1');
    expect(prisma.doc.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['d1'] }, userId: 'user' },
      select: { id: true, title: true },
    });
    expect(docs.remove).toHaveBeenCalledWith('user', 'd1');
    expect(notifications.resolveUserSubjectPrefixes).toHaveBeenCalledWith(
      'user',
      [
        'update-result:u1:',
        'update-waiting:u1:',
        'update-result:u2:',
        'update-waiting:u2:',
      ],
    );
  });
});
