import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdateStatus,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import { compareVersions } from 'src/integrations/releases';
import {
  createProxmoxClient,
  ProxmoxGuestRef,
  ProxmoxResource,
} from 'src/proxmox/proxmox.client';
import { UpdateWithAccount } from '../app-update.types';
import { installedVersion } from './installedVersion';
import { lisbon } from './updateDates';
import { UpdateCheck, formatGb, isMajorJump } from './updateChecks';

/** As medições (🔒 medido pelo MyHomeLab): factos para o agente decidir, não travões. */
export async function codeChecks(
  prisma: PrismaService,
  update: UpdateWithAccount,
  server: ServerConnection,
  ref: ProxmoxGuestRef,
): Promise<UpdateCheck[]> {
  const checks = await commonChecks(prisma, update);
  return [...checks, ...(await serverChecks(prisma, update, server, ref))];
}

/** Há quanto tempo, em linguagem simples: "40 min", "3 h", "2 dias". */
const ageLabel = (ms: number) =>
  ms < 3_600_000
    ? `${Math.max(1, Math.round(ms / 60_000))} min`
    : ms < 86_400_000
      ? `${Math.round(ms / 3_600_000)} h`
      : `${Math.round(ms / 86_400_000)} dias`;

/** As medições de qualquer atualização: salto major e backup recente. */
export async function commonChecks(
  prisma: PrismaService,
  update: UpdateWithAccount,
): Promise<UpdateCheck[]> {
  const checks: UpdateCheck[] = [];
  const major = isMajorJump(update.fromVersion, update.toVersion);
  checks.push({
    point: 'Salto de versão major',
    ok: !major,
    evidence: major
      ? `${update.fromVersion} → ${update.toVersion} é um salto major`
      : `${update.fromVersion} → ${update.toVersion}, não é major`,
    source: 'code',
  });

  // O host não tem backups do MyHomeLab: o backup da configuração está nas regras.
  if (!update.accountId) return checks;
  const jobs = await prisma.backupJob.findMany({
    where: { accountId: update.accountId, isActive: true },
  });
  const freshest = jobs
    .map((job) => job.lastSuccessAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  // A idade máxima do backup é das regras de cada app (ex.: 1 hora no Forgejo); aqui só se mede.
  checks.push({
    point: 'Os backups do MyHomeLab desta app estão ativos e já correram bem',
    ok: Boolean(jobs.length && freshest),
    evidence: !jobs.length
      ? 'não há backup automático desta app (Apps ligadas → a app → Backups)'
      : freshest
        ? `o último backup bom foi a ${lisbon(freshest)} (há ${ageLabel(Date.now() - freshest.getTime())})`
        : 'o backup automático ainda não correu bem nenhuma vez',
    source: 'code',
  });
  return checks;
}

/** As medições do host (Proxmox VE): responde, a versão e o disco da raiz. */
export async function hostChecks(
  server: ServerConnection,
): Promise<UpdateCheck[]> {
  const client = createProxmoxClient(toProxmoxConnection(server));
  const nodes = await client.listNodes().catch(() => []);
  if (!nodes.length) {
    return [
      {
        point: 'O Proxmox responde',
        ok: false,
        evidence: 'o Proxmox não respondeu à lista de nós',
        source: 'code',
      },
    ];
  }
  const checks: UpdateCheck[] = [];
  for (const { node } of nodes) {
    const status = await client.nodeStatus(node).catch(() => null);
    checks.push({
      point: `O nó ${node} responde`,
      ok: Boolean(status),
      evidence: status
        ? `${status.pveversion ?? 'versão ?'}, ligado há ${Math.round(status.uptime / 86_400)} dias`
        : 'o nó não respondeu',
      source: 'code',
    });
    if (status)
      checks.push(
        usage(
          `O disco da raiz (/) do nó ${node} está abaixo de 90%`,
          status.rootfs?.used,
          status.rootfs?.total,
          'o Proxmox não disse a ocupação da raiz',
          90,
        ),
      );
  }
  // A lista de antes, para o fim comparar ("as que estavam ligadas continuam ligadas").
  const guests = await client.clusterResources().catch(() => null);
  const running = (guests ?? [])
    .filter(
      (item) =>
        (item.type === 'qemu' || item.type === 'lxc') &&
        item.status === 'running' &&
        !item.template,
    )
    .sort((a, b) => (a.vmid ?? 0) - (b.vmid ?? 0));
  checks.push({
    point: 'As máquinas ligadas antes de instalar',
    ok: guests ? true : null,
    evidence: guests
      ? `${running.length} ligadas: ${running.map((item) => `${item.type === 'qemu' ? 'VM' : 'CT'} ${item.vmid} ${item.name ?? ''}`.trim()).join(', ') || 'nenhuma'}`
      : 'o Proxmox não respondeu à lista das máquinas',
    source: 'code',
  });
  return checks;
}

/** A ocupação de um recurso, abaixo do limite (o que fazer está nas regras da app). */
function usage(
  point: string,
  used: number | undefined,
  max: number | undefined,
  unknown: string,
  limit: number,
): UpdateCheck {
  if (!max) return { point, ok: null, evidence: unknown, source: 'code' };
  const percent = Math.round(((used ?? 0) / max) * 100);
  return {
    point,
    ok: percent < limit,
    evidence: `${percent}% ocupado (${formatGb(used ?? 0)} de ${formatGb(max)})`,
    source: 'code',
  };
}

/** Os travões de uma atualização no servidor: máquina, disco, versão e outras a correr. */
export async function serverChecks(
  prisma: PrismaService,
  update: UpdateWithAccount,
  server: ServerConnection,
  ref: ProxmoxGuestRef,
): Promise<UpdateCheck[]> {
  const checks: UpdateCheck[] = [];
  const client = createProxmoxClient(toProxmoxConnection(server));
  const resource = (
    await client.clusterResources().catch((): ProxmoxResource[] => [])
  ).find(
    (item) =>
      item.vmid === ref.guest.vmid &&
      (item.type === 'lxc' || item.type === 'qemu'),
  );
  checks.push({
    point: 'A máquina está ligada',
    ok: resource ? resource.status === 'running' : false,
    evidence: resource
      ? `${ref.kind === 'qemu' ? 'VM' : 'CT'} ${ref.guest.vmid}: ${resource.status}`
      : 'o Proxmox não respondeu',
    source: 'code',
  });
  const machine = ref.kind === 'qemu' ? 'VM' : 'CT';
  checks.push(
    usage(
      `O disco do ${machine} está abaixo de 90%`,
      ref.kind === 'lxc' ? resource?.disk : undefined,
      ref.kind === 'lxc' ? resource?.maxdisk : undefined,
      'o Proxmox não mede o disco por dentro de uma VM — verifica tu',
      90,
    ),
    usage(
      `A memória do ${machine} não está cheia`,
      resource?.mem,
      resource?.maxmem,
      'o Proxmox não respondeu',
      100,
    ),
  );

  const installed = await installedVersion(update);
  checks.push({
    point: 'A app está a responder e na versão de partida',
    ok: Boolean(installed) && compareVersions(installed!, update.toVersion) < 0,
    evidence: installed
      ? compareVersions(installed, update.toVersion) >= 0
        ? `já está na ${installed} — não há nada a atualizar`
        : `responde na ${installed}`
      : 'a app não respondeu',
    source: 'code',
  });

  const running = await prisma.appUpdate.count({
    where: {
      userId: update.userId,
      serverConnectionId: server.id,
      status: AppUpdateStatus.IN_PROGRESS,
      id: { not: update.id },
    },
  });
  checks.push({
    point: 'Não há outra atualização a correr neste servidor',
    ok: running === 0,
    evidence: running ? `${running} a correr` : 'nenhuma',
    source: 'code',
  });
  return checks;
}
