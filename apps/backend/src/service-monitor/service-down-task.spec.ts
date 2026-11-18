import { ServiceDownTaskService } from './service-down-task.service';
import { CheckResult } from './helpers/checkTarget';
import { appMonitorTarget } from './helpers/appMonitorTarget';

const monitor = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'm1',
    userId: 'u1',
    name: 'Forgejo',
    kind: 'HTTP',
    target: 'https://git.lan',
    serverConnectionId: 's1',
    guestVmid: 105,
    guestName: 'forgejo',
    status: 'UP',
    downTaskId: null,
    accountId: 'acc1',
    recoveredAt: null,
    ...overrides,
  }) as never;

const down: CheckResult = {
  up: false,
  latencyMs: null,
  error: 'connect ECONNREFUSED',
};
const up: CheckResult = { up: true, latencyMs: 42, error: null };
const at = new Date('2026-11-02T14:05:00Z');

const openTask = (key = 'new') => ({
  id: 't1',
  createdAt: new Date('2026-11-02T14:02:00Z'),
  state: { key },
});

const setup = (
  task: ReturnType<typeof openTask> | null = null,
  update: { id: string; boardTaskId: string | null } | null = null,
) => {
  const prisma = {
    boardTask: { findFirst: jest.fn().mockResolvedValue(task) },
    appUpdate: { findFirst: jest.fn().mockResolvedValue(update) },
    project: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'p1', serverConnectionId: 's1' }),
    },
    serverConnection: {
      findUnique: jest.fn().mockResolvedValue({ name: 'pve' }),
    },
    serviceMonitor: { update: jest.fn() },
    agent: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ key: 'engenheiro-de-servidores' }),
    },
    agentSchedule: { create: jest.fn() },
  };
  const board = {
    createTask: jest
      .fn()
      .mockResolvedValue({ id: 't1', key: 'ATU-9', title: 'Serviço falhou' }),
    updateTask: jest.fn(),
    comment: jest.fn().mockResolvedValue(undefined),
    ensureUpdatesProject: jest.fn(),
  };
  const service = new ServiceDownTaskService(prisma as never, board as never);
  return { service, prisma, board };
};

describe('ServiceDownTaskService', () => {
  it('uma falha cria a tarefa em Todo, com prioridade alta, e dispara o agente dos comandos', async () => {
    const { service, prisma, board } = setup();
    await service.wentDown(monitor(), down, at);

    const [, input, actor] = board.createTask.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(input).toMatchObject({
      projectId: 'p1',
      title: 'Serviço Forgejo falhou',
      stateKey: 'new',
      priority: 'HIGH',
      assignee: 'engenheiro-de-servidores',
    });
    expect(input.description).toContain('ECONNREFUSED');
    expect(actor).toBe('MyHomeLab');
    expect(board.updateTask).not.toHaveBeenCalled();
    expect(prisma.serviceMonitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { downTaskId: 't1' },
    });
    const [{ data }] = prisma.agentSchedule.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({
      agentKey: 'engenheiro-de-servidores',
      repeat: 'ONCE',
      linkType: 'TASK',
      targetId: 't1',
      tags: ['falha'],
    });
  });

  it('com a tarefa ainda aberta não cria outra', async () => {
    const { service, prisma, board } = setup(openTask());
    await service.wentDown(
      monitor({ status: 'DOWN', downTaskId: 't1' }),
      down,
      at,
    );
    expect(board.createTask).not.toHaveBeenCalled();
    expect(board.comment).not.toHaveBeenCalled();
    expect(prisma.agentSchedule.create).not.toHaveBeenCalled();
  });

  it('se tinha recuperado e volta a falhar, só comenta na tarefa aberta', async () => {
    const { service, board } = setup(openTask());
    await service.wentDown(
      monitor({ status: 'UP', downTaskId: 't1' }),
      down,
      at,
    );
    expect(board.createTask).not.toHaveBeenCalled();
    expect(board.comment).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.stringContaining('Voltou a falhar às 14:05'),
      'MyHomeLab',
    );
  });

  it('numa falha nova, com a tarefa anterior fechada, cria uma nova', async () => {
    const { service, board } = setup(null);
    await service.wentDown(
      monitor({ status: 'UP', downTaskId: 'antiga' }),
      down,
      at,
    );
    expect(board.createTask).toHaveBeenCalled();
  });

  it('a mesma falha com a tarefa fechada não cria outra', async () => {
    const { service, board } = setup(null);
    await service.wentDown(
      monitor({ status: 'DOWN', downTaskId: 'antiga' }),
      down,
      at,
    );
    expect(board.createTask).not.toHaveBeenCalled();
  });

  it('quando volta a responder, comenta quanto tempo esteve em baixo e passa a Verifying', async () => {
    const { service, prisma, board } = setup(openTask());
    await service.cameBack(
      monitor({ status: 'DOWN', downTaskId: 't1' }),
      up,
      at,
    );
    expect(board.comment).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.stringContaining(
        'Voltou a responder às 14:05 (42 ms), depois de uns 3 min em baixo',
      ),
      'MyHomeLab',
    );
    expect(board.updateTask).toHaveBeenCalledWith(
      'u1',
      't1',
      { stateKey: 'verifying' },
      'MyHomeLab',
    );
    expect(prisma.serviceMonitor.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { recoveredAt: at },
    });
  });

  it('com a tarefa à espera de uma resposta dele, comenta mas não a muda de coluna', async () => {
    const { service, board } = setup(openTask('waiting'));
    await service.cameBack(
      monitor({ status: 'DOWN', downTaskId: 't1' }),
      up,
      at,
    );
    expect(board.comment).toHaveBeenCalled();
    expect(board.updateTask).not.toHaveBeenCalled();
  });

  it('estável 10 minutos depois de voltar, fecha a tarefa em Verifying', async () => {
    const { service, board } = setup(openTask('verifying'));
    await service.cameBack(
      monitor({
        status: 'UP',
        downTaskId: 't1',
        recoveredAt: new Date('2026-11-02T13:54:00Z'),
      }),
      up,
      at,
    );
    expect(board.comment).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.stringContaining('fechada pelo MyHomeLab'),
      'MyHomeLab',
    );
    expect(board.updateTask).toHaveBeenCalledWith(
      'u1',
      't1',
      { stateKey: 'done' },
      'MyHomeLab',
    );
  });

  it('antes dos 10 minutos ainda não fecha', async () => {
    const { service, board } = setup(openTask('verifying'));
    await service.cameBack(
      monitor({
        status: 'UP',
        downTaskId: 't1',
        recoveredAt: new Date('2026-11-02T14:00:00Z'),
      }),
      up,
      at,
    );
    expect(board.updateTask).not.toHaveBeenCalled();
  });

  it('se mexeram na tarefa entretanto, não a fecha', async () => {
    const { service, board } = setup(openTask('in_progress'));
    await service.cameBack(
      monitor({
        status: 'UP',
        downTaskId: 't1',
        recoveredAt: new Date('2026-11-02T13:50:00Z'),
      }),
      up,
      at,
    );
    expect(board.updateTask).not.toHaveBeenCalled();
  });

  it('durante uma atualização da app não abre tarefa: fica dito na tarefa da atualização', async () => {
    const { service, prisma, board } = setup(null, {
      id: 'up1',
      boardTaskId: 'atu5',
    });
    await service.wentDown(monitor(), down, at);
    expect(board.createTask).not.toHaveBeenCalled();
    expect(prisma.agentSchedule.create).not.toHaveBeenCalled();
    expect(board.comment).toHaveBeenCalledWith(
      'u1',
      'atu5',
      expect.stringContaining('durante a atualização'),
      'MyHomeLab',
    );
  });

  it('um serviço que já estava de pé não comenta nada', async () => {
    const { service, board } = setup(openTask());
    await service.cameBack(monitor({ status: 'UP', downTaskId: 't1' }), up, at);
    expect(board.comment).not.toHaveBeenCalled();
  });
});

describe('appMonitorTarget', () => {
  it.each([
    [{ baseUrl: 'https://git.lan', caldavUrl: null }, 'https://git.lan'],
    [
      {
        baseUrl: null,
        caldavUrl: 'https://cloud.lan/remote.php/dav/calendars/user/',
      },
      'https://cloud.lan',
    ],
    [{ baseUrl: null, caldavUrl: null }, null],
  ])('%j → %s', (account, expected) => {
    expect(appMonitorTarget(account)).toBe(expected);
  });
});
