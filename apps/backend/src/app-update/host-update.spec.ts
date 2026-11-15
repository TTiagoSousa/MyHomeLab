import {
  AppUpdate,
  AppUpdateStatus,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { AppUpdateService } from './app-update.service';
import { taskTitle } from './helpers/taskFields';
import { UpdateWithAccount } from './app-update.types';
import { debianChangelogSince } from './helpers/releaseNotes';
import { logTitle } from './helpers/logContent';
import { updateDocs } from './helpers/updateDocs';
import {
  isHostUpdate,
  targetLabel,
  targetLink,
  updateLabel,
} from './helpers/updateFields';

jest.mock('src/proxmox/proxmox.client', () => ({
  createProxmoxClient: () => ({
    version: () => Promise.resolve({ version: '9.2.2' }),
  }),
}));
jest.mock('src/server-connection/server-connection.service', () => ({
  ...jest.requireActual<object>(
    'src/server-connection/server-connection.service',
  ),
  toProxmoxConnection: () => ({}),
}));

const server = {
  id: 's1',
  userId: 'u1',
  name: 'HomeLab',
} as ServerConnection;

const hostUpdate = (fields: Partial<AppUpdate> = {}) =>
  ({
    id: 'up1',
    userId: 'u1',
    accountId: null,
    hostServerId: 's1',
    componentTitle: null,
    hostPackages: null,
    status: AppUpdateStatus.STUDY,
    fromVersion: '9.2.2',
    toVersion: '9.2.3',
    ...fields,
    account: null,
    hostServer: server,
  }) as unknown as UpdateWithAccount;

const appUpdate = {
  id: 'up2',
  accountId: 'a1',
  hostServerId: null,
  componentTitle: null,
  hostPackages: null,
  fromVersion: '0.107.59',
  account: { provider: 'ADGUARD', displayName: null },
  hostServer: null,
} as unknown as UpdateWithAccount;

const service = (prisma: Record<string, unknown>) => {
  const record = {
    save: jest.fn((update: AppUpdate) => Promise.resolve(update)),
  };
  const updates = new AppUpdateService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    record as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { updates, record };
};

describe('o alvo de uma atualização', () => {
  it('uma app e o host têm nomes e ligações diferentes', () => {
    expect(isHostUpdate(hostUpdate())).toBe(true);
    expect(isHostUpdate(appUpdate)).toBe(false);
    expect(targetLabel(hostUpdate())).toBe('Proxmox VE · HomeLab');
    expect(updateLabel(hostUpdate())).toBe('Proxmox VE · HomeLab');
    expect(targetLink(hostUpdate())).toEqual({
      type: 'SERVER',
      targetId: 's1',
      label: 'HomeLab',
    });
    expect(targetLink(appUpdate).type).toBe('APP');
  });

  it('os pacotes do sistema têm nome e título próprios', () => {
    const packages = hostUpdate({
      hostPackages: 119,
      fromVersion: '9.2.2',
      toVersion: '9.2.2',
    });
    expect(updateLabel(packages)).toBe(
      'Proxmox VE · HomeLab · pacotes do sistema (119)',
    );
    expect(taskTitle(packages)).toBe(
      'Atualizar os pacotes do sistema do HomeLab (119, Proxmox VE 9.2.2)',
    );
  });
});

describe('o changelog do Proxmox', () => {
  it('fica só com as versões depois da instalada', () => {
    const text = [
      'pve-manager (9.2.4) trixie; urgency=medium',
      '  * correção B',
      '',
      'pve-manager (9.2.3) trixie; urgency=medium',
      '  * correção A',
      '',
      'pve-manager (9.2.2) trixie; urgency=medium',
      '  * já instalada',
    ].join('\n');
    const notes = debianChangelogSince(text, '9.2.2');
    expect(notes).toContain('correção A');
    expect(notes).toContain('correção B');
    expect(notes).not.toContain('já instalada');
  });

  it('sem nada depois da instalada, fica vazio', () => {
    expect(
      debianChangelogSince(
        'pve-manager (9.2.2) trixie; urgency=medium',
        '9.2.2',
      ),
    ).toBe('');
  });
});

describe('a versão nova do Proxmox VE', () => {
  const pve = {
    nodes: [{ node: 'proxmox', updates: 119 }],
    total: 119,
    pve: { from: '9.2.2', to: '9.2.3' },
    packages: [],
  };

  it('abre uma atualização do host, só disponível (sem estudo sozinho)', async () => {
    const create = jest.fn((args: { data: Partial<AppUpdate> }) =>
      Promise.resolve({ id: 'new', ...args.data }),
    );
    const { updates, record } = service({
      appUpdate: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create,
      },
    });
    await updates.onServerUpdatesChecked(server, pve);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hostServerId: 's1',
        serverConnectionId: 's1',
        fromVersion: '9.2.2',
        toVersion: '9.2.3',
      }) as unknown,
    });
    expect(record.save).toHaveBeenCalledWith(
      expect.anything(),
      {},
      expect.stringContaining('Fica disponível'),
    );
  });

  it('não abre outra para uma versão já tratada', async () => {
    const create = jest.fn();
    const { updates } = service({
      appUpdate: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ toVersion: '9.2.3' }]),
        create,
      },
    });
    await updates.onServerUpdatesChecked(server, pve);
    expect(create).not.toHaveBeenCalled();
  });

  it('em dia, a em aberto fica feita (atualizada à mão)', async () => {
    const open = hostUpdate({ status: AppUpdateStatus.READY });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, {
      ...pve,
      pve: null,
      total: 0,
    });
    expect(record.save).toHaveBeenCalledWith(
      open,
      expect.objectContaining({ status: AppUpdateStatus.DONE }),
      expect.any(String),
    );
  });

  it('sem resposta de um nó não fecha nada', async () => {
    const open = hostUpdate({ status: AppUpdateStatus.READY });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, {
      ...pve,
      pve: null,
      nodes: [{ node: 'proxmox', updates: 0, error: 'timeout' }],
    });
    expect(record.save).not.toHaveBeenCalled();
  });

  it('a correr ou por verificar, uma versão nova não lhe mexe', async () => {
    const open = hostUpdate({
      status: AppUpdateStatus.VERIFYING,
      toVersion: '9.2.2',
    });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, pve);
    expect(record.save).not.toHaveBeenCalled();
  });

  it('em Ready to update (autorizada por ele), o host instala-se logo, sem janela', async () => {
    const ready = hostUpdate({ status: AppUpdateStatus.READY });
    const { updates } = service({
      appUpdate: {
        findMany: jest.fn().mockResolvedValue([ready]),
        count: jest.fn().mockResolvedValue(0),
      },
      updateWorkflowSetting: {
        findUnique: jest.fn().mockResolvedValue({
          autoInstall: false,
          installFrom: 4,
          installTo: 4,
        }),
      },
    });
    expect(await updates.pendingInstalls(new Set())).toEqual([ready]);
  });
});

describe('as regras de uma atualização do host', () => {
  it('são só as do servidor marcadas como atualização', async () => {
    const docs = {
      requiredGeneral: jest.fn().mockResolvedValue([]),
      linkedToAny: jest.fn().mockResolvedValue([
        { id: 'd1', tags: ['servidores', 'atualizacao', 'proxmox'] },
        { id: 'd2', tags: ['servidores', 'estudo'] },
      ]),
    };
    const found = await updateDocs(docs as never, hostUpdate(), server, null);
    expect(found.map((doc) => doc.id)).toEqual(['d1']);
  });
});

describe('os pacotes do sistema do host', () => {
  const packages = {
    nodes: [{ node: 'proxmox', updates: 119 }],
    total: 119,
    pve: null,
    packages: [],
  };

  it('sem versão nova do Proxmox, abrem uma atualização dos pacotes', async () => {
    const create = jest.fn((args: { data: Partial<AppUpdate> }) =>
      Promise.resolve({ id: 'new', ...args.data }),
    );
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(null), create },
    });
    await updates.onServerUpdatesChecked(server, packages);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hostServerId: 's1',
        fromVersion: '9.2.2',
        toVersion: '9.2.2',
        hostPackages: 119,
      }) as unknown,
    });
    expect(record.save).toHaveBeenCalledWith(
      expect.anything(),
      {},
      expect.stringContaining('Fica disponível'),
    );
  });

  it('mais pacotes atualizam o número da que está aberta', async () => {
    const open = hostUpdate({ hostPackages: 100 });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, packages);
    expect(record.save).toHaveBeenCalledWith(
      open,
      { hostPackages: 119 },
      expect.any(String),
    );
  });

  it('cancelada por ele, só volta com mais pacotes', async () => {
    const create = jest.fn();
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        hostUpdate({ status: AppUpdateStatus.CANCELLED, hostPackages: 119 }),
      );
    const { updates } = service({ appUpdate: { findFirst, create } });
    await updates.onServerUpdatesChecked(server, packages);
    expect(create).not.toHaveBeenCalled();
  });

  it('instalados, a aberta fica feita', async () => {
    const open = hostUpdate({ hostPackages: 119 });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, {
      ...packages,
      total: 0,
      nodes: [{ node: 'proxmox', updates: 0 }],
    });
    expect(record.save).toHaveBeenCalledWith(
      open,
      expect.objectContaining({ status: AppUpdateStatus.DONE }),
      expect.any(String),
    );
  });

  it('uma versão nova do Proxmox passa a aberta dos pacotes para a versão', async () => {
    const open = hostUpdate({ hostPackages: 119, toVersion: '9.2.2' });
    const { updates, record } = service({
      appUpdate: { findFirst: jest.fn().mockResolvedValue(open) },
    });
    await updates.onServerUpdatesChecked(server, {
      ...packages,
      pve: { from: '9.2.2', to: '9.2.3' },
    });
    expect(record.save).toHaveBeenCalledWith(
      open,
      expect.objectContaining({
        toVersion: '9.2.3',
        hostPackages: null,
        status: AppUpdateStatus.STUDY,
      }),
      expect.any(String),
    );
  });
});

describe('o nome do registo', () => {
  it('diz que é o estudo de uma atualização, com as versões', () => {
    expect(logTitle(hostUpdate({ hostPackages: 119 }), null)).toBe(
      'Estudo da atualização · Proxmox · Pacotes do sistema · HomeLab',
    );
    expect(logTitle(hostUpdate(), null)).toBe(
      'Estudo da atualização · Proxmox VE 9.2.2 → 9.2.3 · HomeLab',
    );
    expect(
      logTitle(
        {
          ...appUpdate,
          account: { provider: 'HOME_ASSISTANT', displayName: null },
          componentTitle: 'Tapo Control',
          fromVersion: '7.0.0',
          toVersion: '7.1.0',
          componentGroup: 'hacs',
        } as unknown as UpdateWithAccount,
        'HomeLab',
      ),
    ).toBe(
      'Estudo da atualização · Home Assistant · HACS Tapo Control 7.0.0 → 7.1.0 · HomeLab',
    );
    expect(logTitle({ ...appUpdate, toVersion: '0.107.60' }, 'HomeLab')).toBe(
      'Estudo da atualização · AdGuard 0.107.59 → 0.107.60 · HomeLab',
    );
  });
});
