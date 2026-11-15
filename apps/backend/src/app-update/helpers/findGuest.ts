import { ServerConnection } from 'src/generated/prisma/client/client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';

/** A máquina (CT ou VM) de um servidor, pelo vmid ou pelo nome; ou o porquê de não a encontrar. */
export async function findGuest(server: ServerConnection, guest: string) {
  const client = createProxmoxClient(toProxmoxConnection(server));
  const guests = await client.listGuests().catch(() => null);
  if (!guests) return `O ${server.name} não respondeu.`;
  const needle = guest
    .trim()
    .toLowerCase()
    .replace(/^(ct|vm)\s*/, '');
  const found =
    guests.find((ref) => String(ref.guest.vmid) === needle) ??
    guests.find((ref) => ref.guest.name?.toLowerCase() === needle);
  if (!found) return `Não encontrei a máquina "${guest}" no ${server.name}.`;
  return {
    ref: found,
    label:
      `${found.kind === 'qemu' ? 'VM' : 'CT'} ${found.guest.vmid} ${found.guest.name ?? ''}`.trim(),
  };
}
