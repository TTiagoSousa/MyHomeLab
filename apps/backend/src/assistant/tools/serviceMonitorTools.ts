import { ServiceMonitorService } from 'src/service-monitor/service-monitor.service';
import { NotificationService } from 'src/notification/notification.service';

type MonitorView = Awaited<ReturnType<ServiceMonitorService['list']>>[number];

const STATUS_TEXT: Record<string, string> = {
  UP: 'online',
  DOWN: 'em baixo',
  UNKNOWN: 'ainda por verificar',
};

const formatDate = (date: Date | string | null) =>
  date
    ? new Date(date).toLocaleString('pt-PT', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'nunca';

function describeMonitor(monitor: MonitorView): string {
  const parts = [
    `${monitor.name} (${monitor.kind}) — ${STATUS_TEXT[monitor.status] ?? monitor.status}`,
    `endereço ${monitor.target}`,
    `verificado de ${monitor.intervalMinutes} em ${monitor.intervalMinutes} min, última vez ${formatDate(monitor.lastCheckedAt)}`,
  ];
  if (monitor.lastLatencyMs != null) parts.push(`${monitor.lastLatencyMs} ms`);
  if (monitor.server) {
    parts.push(
      monitor.guestVmid
        ? `servidor ${monitor.server.name}, máquina ${monitor.guestName ?? monitor.guestVmid}`
        : `servidor ${monitor.server.name}`,
    );
  }
  if (monitor.app) parts.push(`da app ${monitor.app.name}`);
  if (monitor.guestMissing)
    parts.push('a máquina associada já não existe no Proxmox');
  if (monitor.status === 'DOWN' && monitor.lastError)
    parts.push(`erro: ${monitor.lastError}`);
  return parts.join('; ');
}

/** Encontra um serviço pelo nome: primeiro igual, depois contido, sem ligar a maiúsculas. */
function findMonitor(monitors: MonitorView[], name: string) {
  const needle = name.trim().toLowerCase();
  return (
    monitors.find((monitor) => monitor.name.toLowerCase() === needle) ??
    monitors.find((monitor) => monitor.name.toLowerCase().includes(needle)) ??
    null
  );
}

const notFound = (monitors: MonitorView[], name: string) =>
  monitors.length
    ? `Não há nenhum serviço chamado "${name}". Os que existem: ${monitors.map((monitor) => monitor.name).join(', ')}.`
    : 'Este utilizador ainda não vigia nenhum serviço. Adicionam-se em Servidores → Serviços.';

export async function listServiceMonitors(
  monitors: ServiceMonitorService,
  userId: string,
): Promise<string> {
  const list = await monitors.list(userId);
  if (!list.length) return notFound(list, '');
  return list.map(describeMonitor).join('\n');
}

export async function checkServiceMonitor(
  monitors: ServiceMonitorService,
  userId: string,
  name: string,
): Promise<string> {
  const list = await monitors.list(userId);
  const monitor = findMonitor(list, name);
  if (!monitor) return notFound(list, name);

  const result = await monitors.checkNow(userId, monitor.id);
  return `Verificado agora. ${describeMonitor(result)}`;
}

export async function listNotifications(
  notifications: NotificationService,
  userId: string,
  includeResolved: boolean,
): Promise<string> {
  const { active, resolved } = await notifications.list(userId);
  const lines: string[] = [];

  lines.push(
    active.length
      ? `Alertas ativos (${active.length}):`
      : 'Não há alertas ativos.',
  );
  for (const notification of active) {
    lines.push(
      `- ${notification.title}: ${notification.message} (desde ${formatDate(notification.createdAt)})`,
    );
  }

  if (includeResolved) {
    lines.push(
      resolved.length
        ? `Resolvidos recentemente (${resolved.length}):`
        : 'Não há alertas resolvidos no histórico.',
    );
    for (const notification of resolved) {
      lines.push(
        `- ${notification.title} (de ${formatDate(notification.createdAt)} a ${formatDate(notification.resolvedAt)})`,
      );
    }
  }
  return lines.join('\n');
}
