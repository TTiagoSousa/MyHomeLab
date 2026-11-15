import { ServerConnection } from 'src/generated/prisma/client/client';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { toProxmoxConnection } from '../server-connection.service';

/** Os snapshots que o MyHomeLab faz antes dos comandos começam assim. */
const PREFIX = 'mhl_pre_';
/** Ficam os últimos destes por máquina; os mais velhos apagam-se. */
const KEPT = 3;
/** Dentro deste tempo, um snapshot recente já serve de volta atrás. */
const RECENT_MS = 30 * 60_000;

/** A máquina em que o comando mexe ("pct exec 113 …", "qm set 101 …"), ou null (o host). */
export function guestOfCommand(command: string): number | null {
  const match =
    /\bpct\s+(?:exec|set|resize|push|restart|reboot|stop|start|shutdown|mount)\s+(\d+)/.exec(
      command,
    ) ??
    /\bqm\s+(?:guest\s+exec|set|resize|reboot|stop|start|shutdown|reset)\s+(\d+)/.exec(
      command,
    );
  return match ? Number(match[1]) : null;
}

/**
 * Antes de um comando que altera uma máquina: um snapshot dela, para haver sempre
 * volta atrás. Não trava nada — se falhar, o comando corre na mesma e fica a nota.
 * Um snapshot do MyHomeLab com menos de 30 minutos já serve; ficam os últimos 3.
 */
export async function snapshotBeforeCommand(
  server: ServerConnection,
  command: string,
  code: string,
): Promise<{ name: string | null; note: string }> {
  const vmid = guestOfCommand(command);
  if (vmid === null) return { name: null, note: '' };
  try {
    const client = createProxmoxClient(toProxmoxConnection(server));
    const ref = (await client.listGuests()).find(
      (item) => item.guest.vmid === vmid,
    );
    if (!ref)
      return {
        name: null,
        note: `(sem snapshot: não encontrei a máquina ${vmid})\n`,
      };
    const mine = (await client.listSnapshots(ref))
      .filter((snapshot) => snapshot.name.startsWith(PREFIX))
      .sort((a, b) => (b.snaptime ?? 0) - (a.snaptime ?? 0));
    const recent = mine[0];
    if (recent?.snaptime && Date.now() - recent.snaptime * 1000 < RECENT_MS) {
      return {
        name: recent.name,
        note: `(este comando conta como alteração — não está na lista dos que só leem —; serve de volta atrás o snapshot recente da máquina ${vmid}: ${recent.name})\n`,
      };
    }
    const name = `${PREFIX}${code}`.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
    const upid = await client.createSnapshot(
      ref,
      name,
      `Antes do comando ${code} (MyHomeLab)`,
    );
    const status = await client.waitTask(ref.node, upid, 5 * 60_000);
    if (status !== 'OK') throw new Error(`o Proxmox respondeu ${status}`);
    for (const old of mine.slice(KEPT - 1)) {
      await client.deleteSnapshot(ref, old.name).catch(() => undefined);
    }
    return {
      name,
      note: `(este comando conta como alteração — não está na lista dos que só leem —, por isso fiz antes o snapshot ${name} da máquina ${vmid})\n`,
    };
  } catch (error) {
    return {
      name: null,
      note: `(o snapshot da máquina ${vmid} falhou: ${error instanceof Error ? error.message : String(error)})\n`,
    };
  }
}
