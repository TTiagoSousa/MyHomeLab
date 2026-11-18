import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { adguardClientFor } from 'src/connected-account/helpers/adguardClientFor';

/** Os intervalos que se podem escolher, em minutos (0 = desligada). */
export const CRON_INTERVALS = [0, 60, 360, 720, 1440, 10080] as const;

export interface CronJobContext {
  accountId: string;
  userId: string;
  accounts: PrismaConnectedAccountRepository;
}

export interface CronJobResult {
  /** O número que a página mostra (ex.: quantas listas mudaram). */
  count?: number;
}

/**
 * Uma tarefa fixa de uma app, escrita aqui em código: o MyHomeLab corre-a sozinho, sem
 * IA, ao intervalo que o utilizador escolhe na página Cron jobs da conta. O título e a
 * explicação estão nas traduções do frontend (`addons:cronJobs.jobs.<chave>`).
 */
export interface CronJobDefinition {
  key: string;
  provider: ConnectionProvider;
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
    context.accountId,
    context.userId,
    context.accounts,
  );
  const filtering = await client.filteringStatus();
  if (filtering.interval) await client.setFilteringConfig(filtering.enabled, 0);
}

function adguardRefresh(allowlist: boolean) {
  return async (context: CronJobContext): Promise<CronJobResult> => {
    const { client } = await adguardClientFor(
      context.accountId,
      context.userId,
      context.accounts,
    );
    const { updated } = await client.refreshFilters(allowlist);
    return { count: updated };
  };
}

export const CRON_JOBS: CronJobDefinition[] = [
  {
    key: 'adguard.refresh_blocklists',
    provider: ConnectionProvider.ADGUARD,
    run: adguardRefresh(false),
    onEnable: stopAdguardOwnInterval,
  },
  {
    key: 'adguard.refresh_allowlists',
    provider: ConnectionProvider.ADGUARD,
    run: adguardRefresh(true),
    onEnable: stopAdguardOwnInterval,
  },
];

export const cronJobsOf = (provider: ConnectionProvider) =>
  CRON_JOBS.filter((job) => job.provider === provider);

export const cronJob = (key: string) =>
  CRON_JOBS.find((job) => job.key === key);
