import { BoardService } from './board.service';
import { projectIdentifier, taskKey } from './helpers/projectIdentifier';

const agents = [
  {
    key: 'infra',
    name: 'Infra Agent',
    tools: ['update_save_study'],
    reportsToId: null,
  },
  { key: 'email', name: 'Email', tools: [], reportsToId: null },
];

const setup = (task: Record<string, unknown>) => {
  const prisma = {
    boardTask: {
      findFirst: jest.fn().mockResolvedValue({
        id: 't1',
        number: 7,
        title: 'Atualizar Forgejo',
        assignee: null,
        updateId: null,
        awaitingReply: false,
        project: { identifier: 'ATU', agentKeys: [] },
        ...task,
      }),
      update: jest.fn(),
    },
    boardTaskComment: { create: jest.fn().mockResolvedValue({ id: 'c1' }) },
    agent: { findMany: jest.fn().mockResolvedValue(agents) },
    agentSchedule: { create: jest.fn() },
    appUpdate: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const todos = {
    openSubject: jest.fn().mockResolvedValue({}),
    closeSubject: jest.fn().mockResolvedValue(null),
  };
  const service = new BoardService(prisma as never, todos as never);
  return { service, prisma, todos };
};

interface ScheduleData {
  agentKey: string;
  repeat: string;
  linkType: string;
  targetId: string;
  instruction: string;
}

const scheduled = (prisma: ReturnType<typeof setup>['prisma']) =>
  (prisma.agentSchedule.create.mock.calls as [{ data: ScheduleData }][]).map(
    ([arg]) => arg.data,
  );

const scheduledAgents = (prisma: ReturnType<typeof setup>['prisma']) =>
  scheduled(prisma).map((data) => data.agentKey);

describe('BoardService.comment', () => {
  it('o comentário de um agente não dispara nada', async () => {
    const { service, prisma } = setup({ assignee: 'infra' });
    await service.comment('u1', 't1', 'Feito.', 'infra');
    expect(prisma.agentSchedule.create).not.toHaveBeenCalled();
  });

  it('o do utilizador põe o responsável a trabalhar, agora e uma vez', async () => {
    const { service, prisma } = setup({ assignee: 'email' });
    await service.comment('u1', 't1', 'Podes ver isto?', 'user');
    expect(scheduledAgents(prisma)).toEqual(['email']);
    const [data] = scheduled(prisma);
    expect(data.repeat).toBe('ONCE');
    expect(data.linkType).toBe('TASK');
    expect(data.targetId).toBe('t1');
    expect(data.instruction).toContain('ATU-7');
  });

  it('as menções escolhem os agentes (pela chave ou pelo primeiro nome)', async () => {
    const { service, prisma } = setup({ assignee: 'email' });
    await service.comment('u1', 't1', '@infra e @Email vejam isto', 'user');
    expect(scheduledAgents(prisma).sort()).toEqual(['email', 'infra']);
  });

  it('sem responsável, uma tarefa de atualização vai para o agente que estuda', async () => {
    const { service, prisma } = setup({ updateId: 'up1' });
    await service.comment('u1', 't1', 'Avança', 'user');
    expect(scheduledAgents(prisma)).toEqual(['infra']);
  });

  it('a resposta do utilizador fecha a pergunta e o "Responder" das Tarefas', async () => {
    const { service, prisma, todos } = setup({
      assignee: 'infra',
      awaitingReply: true,
    });
    await service.comment('u1', 't1', 'Sim, podes', 'user');
    expect(prisma.boardTask.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { awaitingReply: false },
    });
    expect(todos.closeSubject).toHaveBeenCalledWith(
      'u1',
      'board-question:t1',
      'Respondida na tarefa.',
    );
  });
});

describe('BoardService.askUser', () => {
  it('a pergunta deixa a tarefa à espera e abre "Responder" em Tarefas', async () => {
    const { service, prisma, todos } = setup({ assignee: 'infra' });
    const result = await service.askUser(
      'u1',
      't1',
      'Posso reiniciar?',
      'infra',
    );
    expect(result).toEqual({ key: 'ATU-7' });
    expect(prisma.boardTask.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { awaitingReply: true },
    });
    const [userId, subject, todo] = todos.openSubject.mock.calls[0] as [
      string,
      string,
      { list: string; title: string; links: string[] },
    ];
    expect([userId, subject]).toEqual(['u1', 'board-question:t1']);
    expect(todo.list).toBe('Projetos');
    expect(todo.title).toBe('Responder: ATU-7 Atualizar Forgejo');
    expect(todo.links).toEqual(['/MyHomeLab/Projects/t1']);
  });

  it('numa tarefa de atualização recusa (a pergunta vai pelo Waiting da atualização)', async () => {
    const { service, prisma, todos } = setup({ assignee: 'infra' });
    prisma.appUpdate.findFirst.mockResolvedValue({ id: 'up1' });
    await expect(
      service.askUser('u1', 't1', 'Posso?', 'infra'),
    ).rejects.toThrow('update_set_status');
    expect(todos.openSubject).not.toHaveBeenCalled();
  });
});

describe('projectIdentifier', () => {
  it.each([
    ['Instagram da empresa', undefined, 'IE'],
    ['Atualizações', undefined, 'ATU'],
    ['Casa', 'hl-1', 'HL1'],
    ['', undefined, 'TAR'],
  ])('"%s" → %s', (name, wanted, expected) => {
    expect(projectIdentifier(name, wanted)).toBe(expected);
  });

  it('a chave da tarefa', () => {
    expect(taskKey('ATU', 12)).toBe('ATU-12');
    expect(taskKey('', 3)).toBe('TAR-3');
  });
});
