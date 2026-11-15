import {
  createProxmoxClient,
  GuestPowerAction,
  ProxmoxClient,
  ProxmoxConnection,
  ProxmoxGuestRef,
} from 'src/proxmox/proxmox.client';

export interface GuestTarget {
  server: ProxmoxConnection;
  client: ProxmoxClient;
  ref: ProxmoxGuestRef;
}

const label = (ref: ProxmoxGuestRef) =>
  `${ref.kind === 'qemu' ? 'VM' : 'CT'} ${ref.guest.vmid} "${ref.guest.name}"`;

/**
 * A máquina pedida: pelo número (vmid) ou pelo nome, no servidor indicado ou em
 * todos. Devolve uma frase para o agente quando não a encontra ou é ambígua.
 */
export async function findGuestTarget(
  servers: ProxmoxConnection[],
  guest: string,
  wantedServer?: string,
): Promise<GuestTarget | string> {
  if (!servers.length) {
    return 'Não há servidores ligados. Liga-os em Apps ligadas → Proxmox.';
  }
  const picked = wantedServer?.trim()
    ? servers.filter((server) =>
        server.name.toLowerCase().includes(wantedServer.trim().toLowerCase()),
      )
    : servers;
  if (!picked.length) {
    return `Não há nenhum servidor "${wantedServer}". Os que existem: ${servers.map((server) => server.name).join(', ')}.`;
  }

  const needle = guest.trim().toLowerCase();
  const found: GuestTarget[] = [];
  for (const server of picked) {
    const client = createProxmoxClient(server);
    const guests = await client.listGuests();
    const exact = guests.filter(
      (ref) =>
        String(ref.guest.vmid) === needle ||
        ref.guest.name?.toLowerCase() === needle,
    );
    const matches = exact.length
      ? exact
      : guests.filter((ref) => ref.guest.name?.toLowerCase().includes(needle));
    for (const ref of matches) found.push({ server, client, ref });
  }
  if (!found.length) {
    return `Não encontrei nenhuma máquina "${guest}". Vê os nomes com list_proxmox_guests.`;
  }
  if (found.length > 1) {
    return `"${guest}" pode ser: ${found.map((target) => `${label(target.ref)} em ${target.server.name}`).join(', ')}. Diz o número (vmid).`;
  }
  return found[0];
}

/** Espera pela tarefa do Proxmox e diz como acabou. */
async function finished(target: GuestTarget, upid: unknown, done: string) {
  if (typeof upid !== 'string' || !upid.startsWith('UPID:')) return done;
  const status = await target.client.waitTask(target.ref.node, upid);
  if (status === 'OK') return done;
  if (status === 'a correr') {
    return `${done.replace(/\.$/, '')} — a tarefa ainda está a correr no Proxmox (${upid}).`;
  }
  return `A tarefa falhou no Proxmox: ${status} (${upid}).`;
}

const POWER_DONE: Record<GuestPowerAction, string> = {
  start: 'ligada',
  shutdown: 'desligada (pedido ao sistema)',
  stop: 'desligada à força',
  reboot: 'reiniciada',
  suspend: 'suspensa',
  resume: 'retomada',
};

export async function guestPower(
  target: GuestTarget,
  action: GuestPowerAction,
): Promise<string> {
  const upid = await target.client.guestPower(target.ref, action);
  return finished(
    target,
    upid,
    `${label(target.ref)} em ${target.server.name} ${POWER_DONE[action]}.`,
  );
}

export async function guestConfig(target: GuestTarget): Promise<string> {
  const [config, status] = await Promise.all([
    target.client.guestConfig(target.ref),
    target.client.getGuestStatus(target.ref),
  ]);
  const lines = Object.entries(config)
    .filter(([key]) => key !== 'digest' && key !== 'description')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return `${label(target.ref)} em ${target.server.name} (nó ${target.ref.node}) — ${status.status}\n${lines.join('\n')}`;
}

export async function listSnapshots(target: GuestTarget): Promise<string> {
  const snapshots = (await target.client.listSnapshots(target.ref)).filter(
    (snapshot) => snapshot.name !== 'current',
  );
  if (!snapshots.length) return `${label(target.ref)} não tem snapshots.`;
  return snapshots
    .map(
      (snapshot) =>
        `${snapshot.name}${snapshot.snaptime ? ` — ${new Date(snapshot.snaptime * 1000).toISOString().replace('T', ' ').slice(0, 16)}` : ''}` +
        (snapshot.description?.trim()
          ? ` — ${snapshot.description.trim()}`
          : ''),
    )
    .join('\n');
}

export async function createSnapshot(
  target: GuestTarget,
  name?: string,
  description?: string,
): Promise<string> {
  const snapname =
    name?.trim().replace(/[^A-Za-z0-9_-]/g, '_') ||
    `myhomelab_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const upid = await target.client.createSnapshot(
    target.ref,
    snapname,
    description,
  );
  return finished(
    target,
    upid,
    `Snapshot "${snapname}" de ${label(target.ref)} criado.`,
  );
}

export async function rollbackSnapshot(
  target: GuestTarget,
  name: string,
): Promise<string> {
  const upid = await target.client.rollbackSnapshot(target.ref, name);
  return finished(
    target,
    upid,
    `${label(target.ref)} voltou ao snapshot "${name}" (tudo o que mudou depois perdeu-se).`,
  );
}

export async function deleteSnapshot(
  target: GuestTarget,
  name: string,
): Promise<string> {
  const upid = await target.client.deleteSnapshot(target.ref, name);
  return finished(
    target,
    upid,
    `Snapshot "${name}" de ${label(target.ref)} apagado.`,
  );
}

export async function backupNow(
  target: GuestTarget,
  storage?: string,
): Promise<string> {
  let chosen = storage?.trim();
  if (!chosen) {
    const storages = (
      await target.client.listStorages(target.ref.node, 'backup')
    ).filter((item) => item.active !== 0);
    if (!storages.length) {
      return `O nó ${target.ref.node} não tem nenhum storage para backups.`;
    }
    chosen = storages[0].storage;
  }
  const upid = await target.client.backupNow(target.ref, chosen);
  if (typeof upid !== 'string')
    return 'O Proxmox não devolveu a tarefa do backup.';
  const status = await target.client.waitTask(
    target.ref.node,
    upid,
    15 * 60_000,
  );
  if (status === 'OK') {
    return `Backup de ${label(target.ref)} feito no storage ${chosen}.`;
  }
  if (status === 'a correr') {
    return `O backup de ${label(target.ref)} começou no storage ${chosen} e ainda está a correr (${upid}).`;
  }
  return `O backup falhou: ${status} (${upid}).`;
}

export async function setResources(
  target: GuestTarget,
  input: {
    cores?: number;
    memory_mb?: number;
    swap_mb?: number;
    disk_grow_gb?: number;
    disk?: string;
  },
): Promise<string> {
  const changes: Record<string, number> = {};
  if (input.cores) changes.cores = input.cores;
  if (input.memory_mb) changes.memory = input.memory_mb;
  if (input.swap_mb !== undefined && target.ref.kind === 'lxc') {
    changes.swap = input.swap_mb;
  }
  const done: string[] = [];
  if (Object.keys(changes).length) {
    await target.client.setConfig(target.ref, changes);
    done.push(
      Object.entries(changes)
        .map(([key, value]) => `${key}=${value}`)
        .join(', '),
    );
  }
  if (input.disk_grow_gb && input.disk_grow_gb > 0) {
    const disk = input.disk ?? (target.ref.kind === 'lxc' ? 'rootfs' : 'scsi0');
    const upid = await target.client.resizeDisk(
      target.ref,
      disk,
      `+${input.disk_grow_gb}G`,
    );
    done.push(
      await finished(
        { ...target },
        upid,
        `disco ${disk} +${input.disk_grow_gb} GB`,
      ),
    );
  }
  if (!done.length) return 'Não pediste nenhuma alteração.';
  return `${label(target.ref)} atualizada: ${done.join('; ')}. Mudanças de CPU e RAM numa VM podem só valer depois de a reiniciar.`;
}
