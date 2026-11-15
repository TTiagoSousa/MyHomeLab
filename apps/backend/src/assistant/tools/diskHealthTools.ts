import { DiskHealthService } from 'src/disk-health/disk-health.service';

const GIB = 1024 ** 3;

const formatSize = (bytes: number | null) =>
  bytes == null
    ? ''
    : bytes >= 1024 * GIB
      ? `${(bytes / 1024 / GIB).toFixed(1)} TB`
      : `${Math.round(bytes / GIB)} GB`;

/** O resumo da saúde dos discos de todos os servidores do utilizador, para o agente. */
export async function diskHealth(
  diskHealth: DiskHealthService,
  userId: string,
): Promise<string> {
  const servers = await diskHealth.overviewsFor(userId);
  if (!servers.length) {
    return 'Este utilizador não tem servidores Proxmox configurados (Apps ligadas → Proxmox).';
  }

  const lines: string[] = [];
  for (const { server, overview, error } of servers) {
    if (!overview) {
      lines.push(`${server}: não consegui ler os discos — ${error}`);
      continue;
    }
    for (const node of overview.nodes) {
      if (node.error) {
        lines.push(
          `${server} / ${node.node}: não consegui ler os discos — ${node.error}`,
        );
        continue;
      }
      lines.push(
        `${server} / ${node.node}: ${node.disks.length} discos, ${node.pools.length} pools ZFS.`,
      );
      for (const disk of node.disks) {
        const facts = [
          disk.health ? `SMART ${disk.health}` : 'sem dados SMART',
          disk.wearout != null ? `${disk.wearout}% de vida` : null,
          disk.temperature != null ? `${disk.temperature} °C` : null,
          disk.reallocated != null ? `${disk.reallocated} realocados` : null,
          disk.pending != null ? `${disk.pending} pendentes` : null,
        ].filter(Boolean);
        const issues = disk.issues.length
          ? ` — ATENÇÃO: ${disk.issues.map((issue) => issue.text).join('; ')}`
          : '';
        lines.push(
          `- ${disk.model ?? 'disco'} ${formatSize(disk.sizeBytes)} (${disk.devPath}, ${disk.type ?? '?'}): ${facts.join(', ')}${issues}`,
        );
      }
      for (const pool of node.pools) {
        const issues = pool.issues.length
          ? ` — ATENÇÃO: ${pool.issues.map((issue) => issue.text).join('; ')}`
          : '';
        lines.push(
          `- pool ${pool.name}: ${pool.health}, ${Math.round((pool.alloc / pool.size) * 100)}% ocupada${issues}`,
        );
      }
    }
  }
  return lines.join('\n');
}
