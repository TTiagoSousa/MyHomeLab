import {
  ConnectedAccount,
  ConnectionProvider,
  NotificationKind,
} from 'src/generated/prisma/client/client';
import { createForgejoClient } from 'src/forgejo/forgejo.client';
import {
  AppRelease,
  cleanVersion,
  compareVersions,
  latestCodebergRelease,
  latestGithubRelease,
  ReleaseRepository,
} from 'src/integrations/releases';
import { fetchTrekAppConfig, TREK_REPOSITORY } from 'src/trek/trek.client';
import { OPENGYM_REPOSITORY, openGymVersion } from 'src/opengym/opengym.client';
import {
  GAMETRACKER_REPOSITORY,
  gameTrackerVersion,
} from 'src/gametracker/gametracker.client';
import { IMMICH_REPOSITORY, immichVersion } from 'src/immich/immich.client';
import {
  STIRLING_REPOSITORY,
  stirlingVersion,
} from 'src/stirling/stirling.client';
import {
  PAPERLESS_REPOSITORY,
  paperlessVersion,
} from 'src/paperless/paperless.client';
import {
  createHomeAssistantClient,
  HOME_ASSISTANT_REPOSITORY,
} from 'src/home-assistant/home-assistant.client';
import {
  ADGUARD_REPOSITORY,
  createAdguardClient,
} from 'src/adguard/adguard.client';
import {
  NEXTCLOUD_REPOSITORY,
  nextcloudForAccount,
} from 'src/nextcloud/nextcloud.client';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';

interface VersionSource {
  appName: string;
  /** Onde estão as notas e as issues (o estudo das atualizações lê-as daqui). */
  repository: ReleaseRepository;
  installed: (account: ConnectedAccount) => Promise<string>;
  latest: () => Promise<AppRelease | null>;
}

/** As apps ligadas que dizem a versão que têm, e onde se vê a mais recente. */
export const VERSION_SOURCES: Partial<
  Record<ConnectionProvider, VersionSource>
> = {
  [ConnectionProvider.FORGEJO]: {
    appName: 'Forgejo',
    repository: { host: 'codeberg', repo: 'forgejo/forgejo' },
    installed: (account) =>
      createForgejoClient({
        baseUrl: account.baseUrl ?? '',
        token: account.accessToken ?? '',
      }).version(),
    latest: () => latestCodebergRelease('forgejo/forgejo'),
  },
  [ConnectionProvider.TREK]: {
    appName: 'TREK',
    repository: { host: 'github', repo: TREK_REPOSITORY },
    installed: async (account) =>
      (await fetchTrekAppConfig(account.baseUrl ?? '')).version ?? '',
    latest: () => latestGithubRelease(TREK_REPOSITORY),
  },
  [ConnectionProvider.OPENGYM]: {
    appName: 'openGym',
    repository: { host: 'github', repo: OPENGYM_REPOSITORY },
    installed: (account) => openGymVersion(account.baseUrl ?? ''),
    latest: () => latestGithubRelease(OPENGYM_REPOSITORY),
  },
  [ConnectionProvider.GAMETRACKER]: {
    appName: 'GamesTracker',
    repository: { host: 'github', repo: GAMETRACKER_REPOSITORY },
    installed: (account) => gameTrackerVersion(account.baseUrl ?? ''),
    latest: () => latestGithubRelease(GAMETRACKER_REPOSITORY),
  },
  [ConnectionProvider.IMMICH]: {
    appName: 'Immich',
    repository: { host: 'github', repo: IMMICH_REPOSITORY },
    installed: (account) => immichVersion(account.baseUrl ?? ''),
    latest: () => latestGithubRelease(IMMICH_REPOSITORY),
  },
  [ConnectionProvider.PAPERLESS]: {
    appName: 'Paperless-ngx',
    repository: { host: 'github', repo: PAPERLESS_REPOSITORY },
    installed: (account) =>
      paperlessVersion(account.baseUrl ?? '', account.accessToken ?? ''),
    latest: () => latestGithubRelease(PAPERLESS_REPOSITORY),
  },
  [ConnectionProvider.STIRLING_PDF]: {
    appName: 'Stirling-PDF',
    repository: { host: 'github', repo: STIRLING_REPOSITORY },
    installed: (account) =>
      stirlingVersion(account.baseUrl ?? '', account.accessToken ?? ''),
    latest: () => latestGithubRelease(STIRLING_REPOSITORY),
  },
  [ConnectionProvider.HOME_ASSISTANT]: {
    appName: 'Home Assistant',
    repository: { host: 'github', repo: HOME_ASSISTANT_REPOSITORY },
    installed: async (account) =>
      (
        await createHomeAssistantClient(
          account.baseUrl ?? '',
          account.accessToken ?? '',
        ).config()
      ).version,
    latest: () => latestGithubRelease(HOME_ASSISTANT_REPOSITORY),
  },
  [ConnectionProvider.ADGUARD]: {
    appName: 'AdGuard',
    repository: { host: 'github', repo: ADGUARD_REPOSITORY },
    installed: async (account) =>
      (
        await createAdguardClient(
          account.baseUrl ?? '',
          account.username ?? '',
          account.appPassword ?? '',
        ).status()
      ).version,
    latest: () => latestGithubRelease(ADGUARD_REPOSITORY),
  },
  [ConnectionProvider.NEXTCLOUD]: {
    appName: 'Nextcloud',
    repository: { host: 'github', repo: NEXTCLOUD_REPOSITORY },
    installed: async (account) =>
      (await nextcloudForAccount(account).status()).version,
    latest: () => latestGithubRelease(NEXTCLOUD_REPOSITORY),
  },
};

const updateSubject = (account: ConnectedAccount) => `update:${account.id}`;

/**
 * Vê a versão instalada de uma app ligada e a mais recente publicada; guarda as
 * duas e abre (ou mexe n')a atualização (AppUpdate). Se a app ou as releases não
 * responderem, não mexe em nada — não se sabe se já há versão nova.
 */
export async function checkAppVersion(
  account: ConnectedAccount,
  repository: PrismaConnectedAccountRepository,
  notifications: NotificationService,
  updates?: { onVersionChecked(account: ConnectedAccount): Promise<void> },
): Promise<ConnectedAccount> {
  const source = VERSION_SOURCES[account.provider];
  if (!source || !account.baseUrl) return account;

  const [installed, latest] = await Promise.all([
    source.installed(account).then(cleanVersion, () => null),
    source.latest().catch(() => null),
  ]);
  if (!installed || !latest) return account;

  const updateAvailable = compareVersions(latest.version, installed) > 0;
  const updated = await repository.update(account.id, {
    appVersion: installed,
    appLatestVersion: updateAvailable ? latest.version : null,
    appLatestUrl: updateAvailable ? latest.url : null,
    appCheckedAt: new Date(),
  });

  // A versão nova já não abre aviso: vira a atualização e a tarefa do quadro, e é lá
  // que o agente pergunta. Fecha-se só o aviso "tem atualização" de antes.
  await notifications.resolveUserSubject(
    account.userId,
    updateSubject(account),
    NotificationKind.APP_UPDATE,
  );
  // A versão nova vira (ou mexe n')a atualização e na tarefa do quadro.
  await updates?.onVersionChecked(updated).catch(() => undefined);
  return updated;
}
