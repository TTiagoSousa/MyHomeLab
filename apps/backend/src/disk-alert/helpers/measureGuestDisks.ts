import {
  ProxmoxClient,
  ProxmoxGuestRef,
  GuestKind,
} from 'src/proxmox/proxmox.client';

export interface GuestDisk {
  node: string;
  kind: GuestKind;
  vmid: number;
  name: string;
  /** "rootfs" num CT; o ponto de montagem numa VM. */
  target: string;
  usedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface GuestDiskReading {
  disks: GuestDisk[];
  /** As VMs ligadas de que não se sabe o disco por dentro (sem QEMU guest agent). */
  noAgent: { vmid: number; name: string }[];
}

const GIB = 1024 ** 3;
const SKIP_TYPES = new Set([
  'tmpfs',
  'devtmpfs',
  'squashfs',
  'overlay',
  'iso9660',
  'proc',
  'sysfs',
  'ramfs',
  'efivarfs',
  'cdfs',
  'udf',
]);
const SKIP_MOUNTS = ['/boot', '/snap', '/run', '/dev', '/sys', '/proc'];

const percentOf = (used: number, total: number) =>
  total ? Math.round((used / total) * 1000) / 10 : 0;

/**
 * O disco dos CTs e VMs ligados: num CT, o rootfs (o Proxmox sabe-o sempre); numa VM, cada
 * sistema de ficheiros lá dentro pelo QEMU guest agent — sem agente, fica em `noAgent`.
 * Ficam de fora os de sistema (/boot, /run…), os virtuais e os de menos de 1 GB.
 */
export async function measureGuestDisks(
  client: ProxmoxClient,
  guests: 'all' | number[],
): Promise<GuestDiskReading> {
  const wanted = (vmid: number) => guests === 'all' || guests.includes(vmid);
  const running = (await client.clusterResources()).filter(
    (resource) =>
      (resource.type === 'lxc' || resource.type === 'qemu') &&
      resource.status === 'running' &&
      !resource.template &&
      resource.vmid !== undefined &&
      resource.node &&
      wanted(resource.vmid),
  );
  const reading: GuestDiskReading = { disks: [], noAgent: [] };
  for (const resource of running) {
    const vmid = resource.vmid!;
    const name = resource.name ?? String(vmid);
    const node = resource.node!;
    if (resource.type === 'lxc') {
      const total = resource.maxdisk ?? 0;
      if (!total) continue;
      const used = resource.disk ?? 0;
      reading.disks.push({
        node,
        kind: 'lxc',
        vmid,
        name,
        target: 'rootfs',
        usedBytes: used,
        totalBytes: total,
        percent: percentOf(used, total),
      });
      continue;
    }
    const ref: ProxmoxGuestRef = {
      node,
      kind: 'qemu',
      guest: { vmid, name, status: 'running' },
    };
    try {
      const seen = new Set<string>();
      for (const fs of await client.guestFsInfo(ref)) {
        const total = fs['total-bytes'] ?? 0;
        const used = fs['used-bytes'] ?? 0;
        if (
          SKIP_TYPES.has(fs.type) ||
          SKIP_MOUNTS.some((mount) => fs.mountpoint.startsWith(mount)) ||
          total < GIB ||
          seen.has(fs.name)
        )
          continue;
        seen.add(fs.name);
        reading.disks.push({
          node,
          kind: 'qemu',
          vmid,
          name,
          target: fs.mountpoint,
          usedBytes: used,
          totalBytes: total,
          percent: percentOf(used, total),
        });
      }
    } catch {
      reading.noAgent.push({ vmid, name });
    }
  }
  return reading;
}
