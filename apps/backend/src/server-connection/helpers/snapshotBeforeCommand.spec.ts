import { ServerConnection } from 'src/generated/prisma/client/client';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { guestOfCommand, snapshotBeforeCommand } from './snapshotBeforeCommand';

jest.mock('src/proxmox/proxmox.client', () => ({
  createProxmoxClient: jest.fn(),
}));
jest.mock('src/server-connection/server-connection.service', () => ({
  toProxmoxConnection: (server: unknown) => server,
}));

const server = { id: 's1' } as ServerConnection;
const ref = { node: 'pve', guest: { vmid: 113 } };

const fakeClient = (snapshots: { name: string; snaptime?: number }[]) => {
  const client = {
    listGuests: jest.fn().mockResolvedValue([ref]),
    listSnapshots: jest.fn().mockResolvedValue(snapshots),
    createSnapshot: jest.fn().mockResolvedValue('UPID:1'),
    waitTask: jest.fn().mockResolvedValue('OK'),
    deleteSnapshot: jest.fn().mockResolvedValue(undefined),
  };
  (createProxmoxClient as jest.Mock).mockReturnValue(client);
  return client;
};

describe('guestOfCommand', () => {
  it.each([
    ['pct exec 113 -- apt upgrade -y', 113],
    ['pct resize 113 rootfs +5G', 113],
    ['qm set 101 --memory 4096', 101],
    ['qm guest exec 102 -- reboot', 102],
    ['apt upgrade -y', null],
    ['pct list', null],
  ])('"%s" → %s', (command, vmid) => {
    expect(guestOfCommand(command)).toBe(vmid);
  });
});

describe('snapshotBeforeCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('comandos do host não fazem snapshot', async () => {
    const result = await snapshotBeforeCommand(server, 'apt update', 'C1');
    expect(result).toEqual({ name: null, note: '' });
    expect(createProxmoxClient).not.toHaveBeenCalled();
  });

  it('faz um snapshot novo e deixa só os últimos 3', async () => {
    const old = (n: number) => ({
      name: `mhl_pre_old${n}`,
      snaptime: 1000 + n,
    });
    const client = fakeClient([
      old(1),
      old(2),
      old(3),
      { name: 'manual', snaptime: 5000 },
    ]);
    const result = await snapshotBeforeCommand(
      server,
      'pct exec 113 -- apt upgrade',
      'AB-12',
    );
    expect(result.name).toBe('mhl_pre_AB_12');
    expect(client.createSnapshot).toHaveBeenCalledWith(
      ref,
      'mhl_pre_AB_12',
      expect.any(String),
    );
    const deleted = (
      client.deleteSnapshot.mock.calls as [unknown, string][]
    ).map(([, name]) => name);
    expect(deleted).toEqual(['mhl_pre_old1']);
    expect(deleted).not.toContain('manual');
  });

  it('reaproveita um snapshot com menos de 30 minutos', async () => {
    const client = fakeClient([
      { name: 'mhl_pre_recent', snaptime: Math.floor(Date.now() / 1000) - 60 },
    ]);
    const result = await snapshotBeforeCommand(
      server,
      'pct set 113 --cores 4',
      'C2',
    );
    expect(result.name).toBe('mhl_pre_recent');
    expect(client.createSnapshot).not.toHaveBeenCalled();
  });

  it('se o snapshot falhar não trava: devolve a nota', async () => {
    const client = fakeClient([]);
    client.waitTask.mockResolvedValue('ERROR');
    const result = await snapshotBeforeCommand(
      server,
      'pct exec 113 -- reboot',
      'C3',
    );
    expect(result.name).toBeNull();
    expect(result.note).toMatch(/falhou/);
  });
});
