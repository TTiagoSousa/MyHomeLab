import {
  AppUpdate,
  UpdateAttemptKind,
  UpdateAttemptStatus,
  UpdateCheckState,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateAttemptService } from './update-attempt.service';
import { UpdateCheck } from './helpers/updateChecks';

type Row = Record<string, unknown> & { id: string };

/** Uma base de dados de mentira, só com as tentativas e os pontos. */
const fakePrisma = () => {
  const attempts: Row[] = [];
  const checks: Row[] = [];
  let next = 0;
  const id = () => `id${++next}`;
  const withChecks = (attempt: Row) => ({
    ...attempt,
    checks: checks
      .filter((check) => check.attemptId === attempt.id)
      .sort((a, b) => (a.position as number) - (b.position as number)),
  });
  const prisma = {
    updateAttempt: {
      findFirst: ({
        where,
      }: {
        where: { updateId: string; status: { in: string[] } };
      }) => {
        const found = attempts
          .filter(
            (attempt) =>
              attempt.updateId === where.updateId &&
              where.status.in.includes(attempt.status as string),
          )
          .pop();
        return Promise.resolve(found ? withChecks(found) : null);
      },
      count: ({ where }: { where: { updateId: string } }) =>
        Promise.resolve(
          attempts.filter((attempt) => attempt.updateId === where.updateId)
            .length,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: id(),
          status: UpdateAttemptStatus.CHECKING,
          ...data,
        };
        attempts.push(row);
        return Promise.resolve(withChecks(row));
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = attempts.find((attempt) => attempt.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    },
    updateAttemptCheck: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: id(),
          state: UpdateCheckState.PENDING,
          evidence: null,
          checkedBy: null,
          checkedAt: null,
          proof: null,
          source: null,
          who: 'agent',
          ...data,
        };
        checks.push(row);
        return Promise.resolve(row);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = checks.find((check) => check.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      },
      deleteMany: ({ where }: { where: { id: { in: string[] } } }) => {
        for (const gone of where.id.in) {
          checks.splice(
            checks.findIndex((check) => check.id === gone),
            1,
          );
        }
        return Promise.resolve({ count: where.id.in.length });
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, checks };
};

const update = {
  id: 'up1',
  userId: 'u1',
  accountId: 'a1',
  hostServerId: null,
  fromVersion: '15.0.0',
  toVersion: '17.0.1',
} as unknown as AppUpdate;

const measured = (major: boolean, backup: boolean): UpdateCheck[] => [
  {
    point: 'Salto de versão major',
    ok: !major,
    evidence: major ? '15.0.0 → 17.0.1 é um salto major' : 'não é major',
    source: 'code',
  },
  {
    point: 'Os backups do MyHomeLab desta app estão ativos e já correram bem',
    ok: backup,
    evidence: backup ? 'o último backup bom foi há 2 h' : 'não há backup',
    source: 'code',
  },
];

const RULES = [
  '**Salto de versão major** (ex.: 12 → 13): eu disse que sim (👤 Forgejo – como estudar)',
  '**Os backups do Forgejo estão ativos** (list_backups) (Forgejo – como estudar)',
  'Tem benefícios para nós (Forgejo – como estudar)',
];

const open = (
  service: UpdateAttemptService,
  checks: UpdateCheck[],
  fresh = true,
) =>
  service.open(update, {
    title: 'Estudo · Forgejo 15.0.0 → 17.0.1',
    before: RULES,
    after: [],
    measured: checks,
    docs: [],
    fresh,
    kind: UpdateAttemptKind.STUDY,
  });

describe('a tentativa junta as medições aos pontos iguais das regras', () => {
  it('não há pontos em dobro: as medições entram nos pontos das regras', async () => {
    const { prisma } = fakePrisma();
    const attempt = await open(
      new UpdateAttemptService(prisma),
      measured(true, false),
    );
    expect(attempt.checks).toHaveLength(3);
    expect(attempt.checks.some((check) => check.who === 'code')).toBe(false);
  });

  it('o backup fica com o estado medido; o salto major espera pela resposta', async () => {
    const { prisma } = fakePrisma();
    const attempt = await open(
      new UpdateAttemptService(prisma),
      measured(true, false),
    );
    const [major, backup] = attempt.checks;
    expect(major.state).toBe(UpdateCheckState.PENDING);
    expect(major.evidence).toContain('Medido pelo MyHomeLab: 15.0.0 → 17.0.1');
    expect(backup.state).toBe(UpdateCheckState.NOT_VALIDATED);
    expect(backup.checkedBy).toBe('MyHomeLab');
  });

  it('sem salto major, o ponto fica validado pela medição', async () => {
    const { prisma } = fakePrisma();
    const attempt = await open(
      new UpdateAttemptService(prisma),
      measured(false, true),
    );
    expect(attempt.checks[0].state).toBe(UpdateCheckState.VALIDATED);
    expect(attempt.checks[1].state).toBe(UpdateCheckState.VALIDATED);
  });

  it('a medição seguinte não desfaz o que o agente marcou', async () => {
    const { prisma } = fakePrisma();
    const service = new UpdateAttemptService(prisma);
    await open(service, measured(true, false));
    await service.mark(
      'up1',
      { position: 1, state: 'validated', evidence: 'ele disse que sim' },
      'engenheiro-de-servidores',
    );
    const again = await open(service, measured(true, true), false);
    expect(again.checks[0].state).toBe(UpdateCheckState.VALIDATED);
    expect(again.checks[0].evidence).toBe('ele disse que sim');
    expect(again.checks[1].state).toBe(UpdateCheckState.VALIDATED);
  });

  it('sem ponto igual nas regras, a medição fica sozinha', async () => {
    const { prisma } = fakePrisma();
    const attempt = await new UpdateAttemptService(prisma).open(update, {
      title: 'x',
      before: ['Tem benefícios para nós (Forgejo – como estudar)'],
      after: [],
      measured: measured(true, false),
      docs: [],
      fresh: true,
      kind: UpdateAttemptKind.STUDY,
    });
    expect(attempt.checks.filter((check) => check.who === 'code')).toHaveLength(
      2,
    );
  });

  it('o resultado do estudo fica curto', async () => {
    const { prisma } = fakePrisma();
    const service = new UpdateAttemptService(prisma);
    await open(service, measured(true, false));
    const attempt = (await service.current('up1'))!;
    await service.finishStudy('up1', 'Esperar pela resposta.');
    const saved = await prisma.updateAttempt.update({
      where: { id: attempt.id },
      data: {},
    });
    expect(saved.result).toBe(
      'Esperar pela resposta.\n\nFicou 1 ponto não validado e 2 pontos por validar.',
    );
  });
});

describe('uma tentativa que pára guarda o porquê', () => {
  it('o reinício a meio do estudo fica no resultado', async () => {
    const { prisma } = fakePrisma();
    const service = new UpdateAttemptService(prisma);
    const attempt = await open(service, measured(true, false));
    await service.follow(
      { ...update, status: 'STUDY', result: null } as unknown as AppUpdate,
      'O MyHomeLab reiniciou a meio do estudo: volta à espera de estudo.',
    );
    const saved = await prisma.updateAttempt.update({
      where: { id: attempt.id },
      data: {},
    });
    expect(saved.status).toBe(UpdateAttemptStatus.STOPPED);
    expect(saved.result).toBe(
      'O MyHomeLab reiniciou a meio do estudo: volta à espera de estudo.',
    );
  });
});

describe('uma instalação nova nunca reaproveita a anterior', () => {
  const prepare = (service: UpdateAttemptService, status: string) =>
    service.open({ ...update, status } as unknown as AppUpdate, {
      title: 'Forgejo 15.0.0 → 17.0.1',
      before: RULES,
      after: [],
      measured: [],
      docs: [],
      fresh: true,
      kind: UpdateAttemptKind.UPDATE,
    });

  it('a verificação que volta a Waiting fecha a tentativa e a preparação seguinte abre outra', async () => {
    const { prisma } = fakePrisma();
    const service = new UpdateAttemptService(prisma);
    const first = await prepare(service, 'READY');
    await service.follow({ ...update, status: 'VERIFYING' } as never);
    await service.follow({ ...update, status: 'WAITING' } as never);
    expect(await service.current('up1')).toBeNull();
    const second = await prepare(service, 'READY');
    expect(second.id).not.toBe(first.id);
    expect(second.number).toBe(2);
  });

  it('a instalação parada a meio (In progress) continua a mesma', async () => {
    const { prisma } = fakePrisma();
    const service = new UpdateAttemptService(prisma);
    const first = await prepare(service, 'READY');
    await service.follow({ ...update, status: 'IN_PROGRESS' } as never);
    const again = await prepare(service, 'IN_PROGRESS');
    expect(again.id).toBe(first.id);
  });
});
