import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { adguardClientFor } from 'src/connected-account/helpers/adguardClientFor';
import {
  DISK_ALERT_JOB,
  DiskAlertService,
} from 'src/disk-alert/disk-alert.service';
import { diskAlertOptions } from 'src/disk-alert/disk-alert.options';
import { VERSION_SOURCES } from 'src/connected-account/helpers/checkAppVersion';
import type { ConnectedAccountService } from 'src/connected-account/connected-account.service';
import {
  UPDATE_CRON_JOBS,
  UpdatePart,
  updateCronOptions,
} from 'src/app-update/helpers/updateCronOptions';

/** Os intervalos que se podem escolher, em minutos (0 = desligada). */
export const CRON_INTERVALS = [0, 60, 360, 720, 1440, 10080] as const;

/** O alvo de uma tarefa: uma app ligada (pelo fornecedor) ou um servidor Proxmox. */
export type CronJobTarget =
  { kind: 'account'; provider: ConnectionProvider } | { kind: 'server' };

/** A quem serve uma tarefa do registo: às contas destes fornecedores, ou aos servidores. */
export type CronJobAudience =
  | { kind: 'account'; providers: readonly ConnectionProvider[] }
  | { kind: 'server' };

export interface CronJobContext {
  userId: string;
  accountId: string | null;
  serverConnectionId: string | null;
  /** As opções já validadas pelo `options` da tarefa (ou vazias). */
  options: unknown;
  accounts: PrismaConnectedAccountRepository;
  diskAlerts: DiskAlertService;
  connected: ConnectedAccountService;
}

export interface CronJobResult {
  /** O número que a página mostra (ex.: quantas listas mudaram). */
  count?: number;
  /** O pormenor que a página pode mostrar (ex.: as VMs sem guest agent). */
  detail?: unknown;
}

/**
 * Uma tarefa fixa de uma app ou de um servidor, escrita aqui em código: o MyHomeLab corre-a
 * sozinho, sem IA, ao intervalo que o utilizador escolhe na página Cron jobs. O título e a
 * explicação estão nas traduções do frontend (`addons:cronJobs.jobs.<chave>`).
 */
export interface CronJobDefinition {
  key: string;
  target: CronJobAudience;
  /** Os intervalos desta tarefa (sem isto, os CRON_INTERVALS). */
  intervals?: readonly number[];
  /** Valida as opções; `enabling` = vai ficar ligada (pode exigir campos). */
  options?: (raw: unknown, enabling: boolean) => unknown;
  run: (context: CronJobContext) => Promise<CronJobResult>;
  /** Ao ligar (de desligada para um intervalo): ex.: desligar o intervalo próprio da app. */
  onEnable?: (context: CronJobContext) => Promise<void>;
}

/**
 * O AdGuard tem o seu próprio intervalo para as listas: com um cron job ligado fica em
 * "nunca", senão as listas descarregavam a dobrar.
 */
async function stopAdguardOwnInterval(context: CronJobContext) {
  const { client } = await adguardClientFor(
    context.accountId!,
    context.userId,
    context.accounts,
  );
  const filtering = await client.filteringStatus();
  if (filtering.interval) await client.setFilteringConfig(filtering.enabled, 0);
}

function adguardRefresh(allowlist: boolean) {
  return async (context: CronJobContext): Promise<CronJobResult> => {
    const { client } = await adguardClientFor(
      context.accountId!,
      context.userId,
      context.accounts,
    );
    const { updated } = await client.refreshFilters(allowlist);
    return { count: updated };
  };
}

const ADGUARD = {
  kind: 'account',
  providers: [ConnectionProvider.ADGUARD],
} as const;

/** As apps self-hosted de que o MyHomeLab sabe ver a versão. */
const VERSIONED = Object.keys(VERSION_SOURCES) as ConnectionProvider[];

/** Vê as versões novas (da app ou das peças) e põe-nas no quadro, se as opções o pedem. */
function updatesJob(
  key: string,
  providers: readonly ConnectionProvider[],
  part: UpdatePart,
): CronJobDefinition {
  return {
    key,
    target: { kind: 'account', providers },
    intervals: [0, 60, 360, 720, 1440],
    options: updateCronOptions,
    run: async (context) => ({
      count: await context.connected.runUpdatesCronJob(
        context.accountId!,
        context.userId,
        part,
        updateCronOptions(context.options, true),
      ),
    }),
  };
}

export const CRON_JOBS: CronJobDefinition[] = [
  updatesJob(UPDATE_CRON_JOBS.app, VERSIONED, 'app'),
  updatesJob(
    UPDATE_CRON_JOBS.haComponents,
    [ConnectionProvider.HOME_ASSISTANT],
    'components',
  ),
  updatesJob(
    UPDATE_CRON_JOBS.nextcloudApps,
    [ConnectionProvider.NEXTCLOUD],
    'components',
  ),
  {
    key: 'adguard.refresh_blocklists',
    target: ADGUARD,
    run: adguardRefresh(false),
    onEnable: stopAdguardOwnInterval,
  },
  {
    key: 'adguard.refresh_allowlists',
    target: ADGUARD,
    run: adguardRefresh(true),
    onEnable: stopAdguardOwnInterval,
  },
  {
    key: DISK_ALERT_JOB,
    target: { kind: 'server' },
    // 1 = "tempo real": o Proxmox não avisa sozinho, por isso pergunta-se de minuto a minuto.
    intervals: [0, 1, 5, 15, 30, 60, 1440],
    options: diskAlertOptions,
    run: (context) =>
      context.diskAlerts.check(
        context.userId,
        context.serverConnectionId!,
        diskAlertOptions(context.options, true),
      ),
  },
];

export const cronJobsFor = (target: CronJobTarget) =>
  CRON_JOBS.filter((job) =>
    target.kind === 'server'
      ? job.target.kind === 'server'
      : job.target.kind === 'account' &&
        job.target.providers.includes(target.provider),
  );

export const cronJob = (key: string) =>
  CRON_JOBS.find((job) => job.key === key);

export const intervalsOf = (job: CronJobDefinition) =>
  job.intervals ?? CRON_INTERVALS;
