import { ProxmoxClient } from 'src/proxmox/proxmox.client';

export interface ServerUpdates {
  /** As atualizações à espera em cada nó (o que o próprio Proxmox já descarregou da lista). */
  nodes: { node: string; updates: number; error?: string }[];
  total: number;
  /** O Proxmox VE em si (pve-manager), quando há versão nova. */
  pve: { from: string; to: string } | null;
  packages: { name: string; from: string | null; to: string }[];
}

const PVE_PACKAGE = 'pve-manager';

/**
 * O que há para atualizar em cada nó, lido de /nodes/{node}/apt/update — a lista
 * que o Proxmox refresca sozinho todos os dias. Um nó que não responda não
 * impede os outros.
 */
export async function serverUpdates(
  client: ProxmoxClient,
): Promise<ServerUpdates> {
  const nodes = await client.listNodes();
  const result: ServerUpdates = {
    nodes: [],
    total: 0,
    pve: null,
    packages: [],
  };
  for (const { node } of nodes) {
    try {
      const updates = await client.aptUpdates(node);
      result.nodes.push({ node, updates: updates.length });
      result.total += updates.length;
      for (const update of updates) {
        if (!result.packages.some((item) => item.name === update.Package)) {
          result.packages.push({
            name: update.Package,
            from: update.OldVersion ?? null,
            to: update.Version,
          });
        }
        if (update.Package === PVE_PACKAGE && !result.pve) {
          result.pve = { from: update.OldVersion ?? '?', to: update.Version };
        }
      }
    } catch (error) {
      result.nodes.push({
        node,
        updates: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  result.packages.sort((a, b) =>
    a.name === PVE_PACKAGE
      ? -1
      : b.name === PVE_PACKAGE
        ? 1
        : a.name.localeCompare(b.name),
  );
  return result;
}
