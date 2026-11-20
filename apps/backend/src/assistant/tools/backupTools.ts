import { BackupService } from 'src/backup/backup.service';
import {
  BackupRetention,
  RunFrequency,
} from 'src/generated/prisma/client/client';

type BackupJobView = Awaited<ReturnType<BackupService['jobs']>>[number];

const FREQUENCY_TEXT: Record<RunFrequency, string> = {
  EVERY_15_MINUTES: 'de 15 em 15 minutos',
  EVERY_30_MINUTES: 'de 30 em 30 minutos',
  HOURLY: 'de hora a hora',
  EVERY_2_HOURS: 'de 2 em 2 horas',
  EVERY_4_HOURS: 'de 4 em 4 horas',
  EVERY_6_HOURS: 'de 6 em 6 horas',
  EVERY_8_HOURS: 'de 8 em 8 horas',
  DAILY: 'todos os dias',
  WEEKLY: 'todas as semanas',
};

const formatDate = (date: Date | null) =>
  date
    ? date.toLocaleString('pt-PT', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'nunca';

const retentionText = (job: BackupJobView) => {
  if (job.retention === BackupRetention.REPLACE)
    return 'substitui (fica só o último)';
  if (job.retention === BackupRetention.KEEP_ALL)
    return 'nunca apaga os antigos';
  return `guarda os últimos ${job.keepCount}`;
};

const jobName = (job: BackupJobView) =>
  job.account
    ? (job.account.displayName ?? job.account.username ?? job.account.provider)
    : 'MyHomeLab';

function describeJob(job: BackupJobView): string {
  const last = job.runs[0];
  const parts = [
    `${jobName(job)} → ${job.destination.name}, pasta ${job.destination.folder}/${job.folder}`,
    job.isActive ? FREQUENCY_TEXT[job.runFrequency] : 'automático desligado',
    retentionText(job),
  ];
  if (!last) parts.push('ainda não correu');
  else if (last.status === 'SUCCESS')
    parts.push(
      `último backup ${formatDate(last.startedAt)} (${last.fileName}${last.sizeBytes ? `, ${Math.round(last.sizeBytes / 1024)} KB` : ''})` +
        (last.missing.length
          ? `, ficou de fora: ${last.missing.join(', ')}`
          : ''),
    );
  else parts.push(`último falhou ${formatDate(last.startedAt)}: ${last.error}`);
  return parts.join('; ');
}

export async function listBackups(backups: BackupService, userId: string) {
  const [jobs, destinations] = await Promise.all([
    backups.jobs(userId),
    backups.destinations(userId),
  ]);
  const lines = [
    destinations.length
      ? `Destinos: ${destinations.map((destination) => `${destination.name} (Nextcloud ${destination.url}, pasta ${destination.folder})`).join('; ')}.`
      : 'Ainda não há nenhum destino de backups. Cria-se em Apps ligadas → Backups (o Nextcloud ligado ou outra conta).',
  ];
  lines.push(
    jobs.length
      ? jobs.map(describeJob).join('\n')
      : 'Não há backups do MyHomeLab configurados.',
    'As apps ligadas já não têm backups no MyHomeLab: o backup completo de uma app é o da própria app ou o do CT/VM no Proxmox (pve_backup_now).',
  );
  return lines.join('\n');
}

export async function runBackup(
  backups: BackupService,
  userId: string,
  name: string,
) {
  const needle = name.trim().toLowerCase();
  const jobs = await backups.jobs(userId);
  const job =
    jobs.find((item) => jobName(item).toLowerCase() === needle) ??
    jobs.find((item) => jobName(item).toLowerCase().includes(needle)) ??
    (jobs.length === 1 ? jobs[0] : null);
  if (!job) {
    return jobs.length
      ? `Não há backup para "${name}": as apps ligadas já não têm backups no MyHomeLab. Para uma app, faz o backup do CT/VM no Proxmox (pve_backup_now, pelo Operador Proxmox). O que existe: ${jobs.map(jobName).join(', ')}.`
      : 'Não há backups do MyHomeLab configurados (Admin → Backup).';
  }
  const result = await backups.runNow(userId, job.id);
  if (!result.ok) return `O backup de ${jobName(job)} falhou: ${result.error}`;
  const extra = [
    result.deleted ? `${result.deleted} backups antigos apagados` : null,
    result.missing.length
      ? `ficou de fora: ${result.missing.join(', ')}`
      : null,
  ].filter(Boolean);
  return `Backup de ${jobName(job)} feito: ${result.fileName}${result.sizeBytes ? ` (${Math.round(result.sizeBytes / 1024)} KB)` : ''}${extra.length ? `; ${extra.join('; ')}` : ''}.`;
}
