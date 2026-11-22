import { DiskAlert, DiskAlertStatus } from 'src/generated/prisma/client/client';
import { ProxmoxClient } from 'src/proxmox/proxmox.client';
import { diskAlertOptions } from './disk-alert.options';
import { measureGuestDisks } from './helpers/measureGuestDisks';
import { DiskAlertService } from './disk-alert.service';

const GIB = 1024 ** 3;

describe('diskAlertOptions', () => {
  it('ao ligar, o limite é obrigatório e com agente os travões também', () => {
    expect(() => diskAlertOptions({}, true)).toThrow('o limite');
    expect(() =>
      diskAlertOptions({ thresholdPercent: 90, agent: true }, true),
    ).toThrow('o máximo do disco');
    expect(
      diskAlertOptions({ thresholdPercent: 90, notify: true }, true),
    ).toMatchObject({
      thresholdPercent: 90,
      notify: true,
      agent: false,
      guests: 'all',
    });
  });

  it('desligado aceita opções por preencher', () => {
    expect(diskAlertOptions(undefined, false).thresholdPercent).toBe(0);
  });

  it('recusa limites fora de 10–99%', () => {
    expect(() => diskAlertOptions({ thresholdPercent: 100 }, true)).toThrow(
      'entre 10% e 99%',
    );
  });
});

describe('measureGuestDisks', () => {
  const client = {
    clusterResources: () =>
      Promise.resolve([
        {
          id: 'lxc/114',
          type: 'lxc',
          node: 'pve',
          vmid: 114,
          name: 'myhomelab',
          status: 'running',
          disk: 15 * GIB,
          maxdisk: 16 * GIB,
        },
        {
          id: 'lxc/115',
          type: 'lxc',
          node: 'pve',
          vmid: 115,
          name: 'parado',
          status: 'stopped',
          disk: 1,
          maxdisk: 2,
        },
        {
          id: 'qemu/120',
          type: 'qemu',
          node: 'pve',
          vmid: 120,
          name: 'nas',
          status: 'running',
        },
        {
          id: 'qemu/121',
          type: 'qemu',
          node: 'pve',
          vmid: 121,
          name: 'sem-agente',
          status: 'running',
        },
      ]),
    guestFsInfo: (ref: { guest: { vmid: number } }) =>
      ref.guest.vmid === 121
        ? Promise.reject(new Error('QEMU guest agent is not running'))
        : Promise.resolve([
            {
              name: 'sda1',
              mountpoint: '/',
              type: 'ext4',
              'total-bytes': 50 * GIB,
              'used-bytes': 46 * GIB,
            },
            {
              name: 'sda15',
              mountpoint: '/boot/efi',
              type: 'vfat',
              'total-bytes': 0.1 * GIB,
              'used-bytes': 0.01 * GIB,
            },
            {
              name: 'tmpfs',
              mountpoint: '/tmp',
              type: 'tmpfs',
              'total-bytes': 4 * GIB,
              'used-bytes': 1 * GIB,
            },
          ]),
  } as unknown as ProxmoxClient;

  it('lê o rootfs dos CTs ligados e as partições reais das VMs com guest agent', async () => {
    const reading = await measureGuestDisks(client, 'all');
    expect(
      reading.disks.map((disk) => [disk.vmid, disk.target, disk.percent]),
    ).toEqual([
      [114, 'rootfs', 93.8],
      [120, '/', 92],
    ]);
    expect(reading.noAgent).toEqual([{ vmid: 121, name: 'sem-agente' }]);
  });

  it('só os CTs e VMs escolhidos', async () => {
    const reading = await measureGuestDisks(client, [114]);
    expect(reading.disks.map((disk) => disk.vmid)).toEqual([114]);
    expect(reading.noAgent).toEqual([]);
  });
});

describe('DiskAlertService — os travões do aumento', () => {
  const alert = (patch: Partial<DiskAlert> = {}): DiskAlert =>
    ({
      id: 'a1',
      userId: 'u1',
      serverConnectionId: 's1',
      node: 'pve',
      guestKind: 'lxc',
      vmid: 114,
      guestName: 'myhomelab',
      target: 'rootfs',
      status: DiskAlertStatus.STUDY,
      usedBytes: 15 * GIB,
      totalBytes: 16 * GIB,
      firstPercent: 93.8,
      percent: 93.8,
      boardTaskId: null,
      agentKey: 'infra',
      study: null,
      question: null,
      askedAt: null,
      approved: false,
      ...patch,
    }) as DiskAlert;

  const setup = (row: DiskAlert, storageFreeGb = 100) => {
    const updates: Record<string, unknown>[] = [];
    const prisma = {
      diskAlert: {
        findFirst: () => Promise.resolve(row),
        update: ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return Promise.resolve({ ...row, ...data });
        },
      },
      cronJob: {
        findUnique: () =>
          Promise.resolve({
            options: {
              thresholdPercent: 90,
              agent: true,
              maxDiskGb: 32,
              stepGb: 4,
              minStorageFreeGb: 20,
            },
          }),
      },
      boardTaskComment: { findMany: () => Promise.resolve([]) },
    };
    const servers = {
      connectionById: () =>
        Promise.resolve({
          name: 'pve',
          host: 'pve.lan',
          port: 8006,
          tokenId: 'x',
          tokenSecret: 'y',
          verifyTls: false,
        }),
    };
    const service = new DiskAlertService(
      prisma as never,
      { onStateChange: jest.fn() } as never,
      {} as never,
      servers as never,
    );
    jest
      .spyOn(
        service as unknown as { clientOf: () => Promise<unknown> },
        'clientOf',
      )
      .mockResolvedValue({
        guestConfig: () =>
          Promise.resolve({ rootfs: 'local-lvm:vm-114-disk-0,size=16G' }),
        clusterResources: () =>
          Promise.resolve([
            {
              type: 'storage',
              storage: 'local-lvm',
              node: 'pve',
              maxdisk: (storageFreeGb + 50) * GIB,
              disk: 50 * GIB,
            },
          ]),
      });
    return { service, updates };
  };

  const study = (growGb: number) => ({
    diagnosis: 'O rootfs está cheio de dados da app.',
    plan: `Aumentar ${growGb} GB.`,
    action: 'grow' as const,
    growGb,
  });

  it('dentro dos limites, num CT, avança sem perguntar', async () => {
    const { service, updates } = setup(alert());
    const reply = await service.saveStudy('u1', 'a1', study(4));
    expect(reply).toContain('Podes avançar');
    expect(updates.some((data) => data.status === DiskAlertStatus.FIXING)).toBe(
      true,
    );
  });

  it('mais do que o passo de cada vez fica à espera dele', async () => {
    const { service, updates } = setup(alert());
    const reply = await service.saveStudy('u1', 'a1', study(8));
    expect(reply).toContain('mais do que os 4 GB');
    expect(
      updates.some((data) => data.status === DiskAlertStatus.WAITING),
    ).toBe(true);
  });

  it('passar do máximo do disco fica à espera dele', async () => {
    const { service } = setup(alert({ totalBytes: 30 * GIB }));
    expect(await service.saveStudy('u1', 'a1', study(4))).toContain(
      'acima do máximo de 32 GB',
    );
  });

  it('deixar o storage abaixo do mínimo nunca passa, mesmo aprovado', async () => {
    const { service } = setup(alert({ approved: true }), 22);
    expect(await service.saveStudy('u1', 'a1', study(4))).toContain(
      'abaixo do mínimo de 20 GB',
    );
  });

  it('numa VM pede sempre o sim dele', async () => {
    const { service } = setup(alert({ guestKind: 'qemu', target: '/' }));
    expect(await service.saveStudy('u1', 'a1', study(4))).toContain(
      'numa VM o aumento precisa sempre do teu sim',
    );
  });
});

describe('DiskAlertService — o check() não deixa avisos presos', () => {
  const row = (patch: Partial<DiskAlert>): DiskAlert =>
    ({
      id: 'a1',
      userId: 'u1',
      serverConnectionId: 's1',
      node: 'pve',
      guestKind: 'lxc',
      vmid: 114,
      guestName: 'myhomelab',
      target: 'rootfs',
      status: DiskAlertStatus.FIXING,
      usedBytes: 15 * GIB,
      totalBytes: 16 * GIB,
      firstPercent: 93.8,
      percent: 93.8,
      boardTaskId: 't1',
      agentKey: 'infra',
      question: null,
      ...patch,
    }) as DiskAlert;

  const setup = (alert: DiskAlert, activeRuns: number, used: number) => {
    const updates: Record<string, unknown>[] = [];
    const resources = [
      {
        type: 'lxc',
        node: 'pve',
        vmid: 114,
        name: 'myhomelab',
        status: 'running',
        disk: used * GIB,
        maxdisk: 16 * GIB,
      },
    ];
    jest
      .spyOn(
        jest.requireActual<typeof import('src/proxmox/proxmox.client')>(
          'src/proxmox/proxmox.client',
        ),
        'createProxmoxClient',
      )
      .mockReturnValue({
        clusterResources: () => Promise.resolve(resources),
      } as never);
    const prisma = {
      diskAlert: {
        findMany: () => Promise.resolve([alert]),
        update: ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return Promise.resolve({ ...alert, ...data });
        },
      },
      agentSchedule: { count: () => Promise.resolve(activeRuns) },
      serverConnection: { findUnique: () => Promise.resolve({ name: 'pve' }) },
    };
    const board = {
      onStateChange: jest.fn(),
      comment: jest.fn().mockResolvedValue(undefined),
      updateTask: jest.fn().mockResolvedValue(undefined),
      askUser: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DiskAlertService(
      prisma as never,
      board as never,
      { resolveUserSubject: jest.fn() } as never,
      { connectionById: () => Promise.resolve({ name: 'pve' }) } as never,
    );
    return { service, updates };
  };
  const options = diskAlertOptions({ thresholdPercent: 90 }, true);

  it('em FIXING sem nenhum agente a correr passa a esperar por ele', async () => {
    const { service, updates } = setup(row({}), 0, 15);
    await service.check('u1', 's1', options);
    expect(
      updates.some((data) => data.status === DiskAlertStatus.WAITING),
    ).toBe(true);
  });

  it('em FIXING com o agente a correr não mexe', async () => {
    const { service, updates } = setup(row({}), 1, 15);
    await service.check('u1', 's1', options);
    expect(updates.some((data) => 'status' in data)).toBe(false);
  });

  it('em FIXING sem agente e já abaixo do limite fecha', async () => {
    const { service, updates } = setup(row({}), 0, 8);
    await service.check('u1', 's1', options);
    expect(updates.some((data) => data.status === DiskAlertStatus.DONE)).toBe(
      true,
    );
  });
});
