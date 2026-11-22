import { Agent } from 'https';
import axios from 'axios';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { cleanVersion, compareVersions } from 'src/integrations/releases';
import { ConnectedAccount } from 'src/generated/prisma/client/client';

export const NEXTCLOUD_REPOSITORY = 'nextcloud/server';

export interface NextcloudStatus {
  version: string;
  maintenance: boolean;
  needsDbUpgrade: boolean;
}

export interface NextcloudUser {
  id: string;
  displayName: string | null;
  /** null: o pedido dos grupos falhou e não se sabe. */
  isAdmin: boolean | null;
}

export interface NextcloudApp {
  id: string;
  name: string;
  version: string;
}

/** Uma app da App Store do Nextcloud: a versão mais recente para esta versão do servidor. */
export interface NextcloudStoreApp {
  id: string;
  name: string;
  latest: string;
  website: string | null;
  issueTracker: string | null;
  /** As versões estáveis, da mais nova para a mais antiga, com o changelog de cada uma. */
  releases: { version: string; created: string | null; changelog: string }[];
}

/** Uma app instalada com versão nova na App Store. */
export interface NextcloudAppUpdate {
  id: string;
  name: string;
  installed: string;
  latest: string;
  releaseUrl: string;
  website: string | null;
}

/** A App Store tem alguns MB: guarda-se uma hora por versão do servidor. */
const STORE_CACHE_MS = 60 * 60_000;
const storeCache = new Map<
  string,
  { at: number; apps: Map<string, NextcloudStoreApp> }
>();

interface OcsResponse<T> {
  ocs?: { data?: T };
}

/** O anfitrião de um endereço (null se estiver mal escrito). */
export const hostOf = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};

/** "/remote.php/dav/…" ou "/index.php/…" no fim do endereço saem: fica a raiz do Nextcloud. */
export const nextcloudRoot = (url: string) =>
  url
    .trim()
    .replace(/\/(remote|index)\.php(\/.*)?$/i, '')
    .replace(/\/+$/, '');

/**
 * A API do Nextcloud com uma password de app: a versão (status.php), o
 * utilizador e se é administrador (OCS), as apps ligadas e as versões delas
 * (precisa de admin) e a App Store. Certificados self-signed aceites, como nos
 * outros serviços da LAN.
 */
export function createNextcloudClient(
  baseUrl: string,
  username: string,
  password: string,
) {
  const http = axios.create({
    baseURL: nextcloudRoot(baseUrl),
    auth: { username, password },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 20_000,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
  });

  async function get<T>(url: string): Promise<T> {
    try {
      return (await http.get<T>(url)).data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 401) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O Nextcloud recusou o utilizador ou a password de app.',
        );
      }
      if (status === 403) {
        throw new AppIntegrationError(
          'APP_NOT_SUPPORTED',
          'O Nextcloud recusou o pedido (403): para as apps é preciso uma conta de administrador.',
        );
      }
      const detail = axios.isAxiosError(error)
        ? error.response
          ? `respondeu ${error.response.status}`
          : error.message
        : String(error);
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o Nextcloud: ${detail}`,
      );
    }
  }

  async function status(): Promise<NextcloudStatus> {
    const data = await get<{
      versionstring?: string;
      maintenance?: boolean;
      needsDbUpgrade?: boolean;
    }>('/status.php');
    if (!data?.versionstring) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não parece ser um Nextcloud.',
      );
    }
    return {
      version: cleanVersion(data.versionstring),
      maintenance: Boolean(data.maintenance),
      needsDbUpgrade: Boolean(data.needsDbUpgrade),
    };
  }

  async function me(): Promise<NextcloudUser> {
    const user = (
      await get<OcsResponse<{ id?: string; displayname?: string }>>(
        '/ocs/v2.php/cloud/user?format=json',
      )
    ).ocs?.data;
    if (!user?.id) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não parece ser um Nextcloud.',
      );
    }
    const groups = (
      await get<OcsResponse<{ groups?: string[] }>>(
        `/ocs/v2.php/cloud/users/${encodeURIComponent(user.id)}/groups?format=json`,
      ).catch(() => null)
    )?.ocs?.data?.groups;
    return {
      id: user.id,
      displayName: user.displayname ?? null,
      isAdmin: groups ? groups.includes('admin') : null,
    };
  }

  /** As apps ligadas (precisa de admin). */
  async function apps(): Promise<NextcloudApp[]> {
    return (await appsRead()).apps;
  }

  /**
   * As apps ligadas, com o nome e a versão instalada, e quantas não se conseguiram
   * ler (essas ficam de fora da lista).
   */
  async function appsRead(): Promise<{
    apps: NextcloudApp[];
    unreadable: number;
  }> {
    const ids =
      (
        await get<OcsResponse<{ apps?: string[] }>>(
          '/ocs/v2.php/cloud/apps?filter=enabled&format=json',
        )
      ).ocs?.data?.apps ?? [];
    const result: NextcloudApp[] = [];
    let unreadable = 0;
    // Em grupos de 8: dezenas de apps sem afogar o servidor.
    for (let index = 0; index < ids.length; index += 8) {
      const infos = await Promise.all(
        ids.slice(index, index + 8).map((id) =>
          get<OcsResponse<{ id?: string; name?: string; version?: string }>>(
            `/ocs/v2.php/cloud/apps/${encodeURIComponent(id)}?format=json`,
          ).then(
            (response) => response.ocs?.data ?? null,
            () => null,
          ),
        ),
      );
      infos.forEach((info, offset) => {
        const id = ids[index + offset];
        if (info?.version) {
          result.push({
            id,
            name: info.name ?? id,
            version: cleanVersion(info.version),
          });
        } else {
          unreadable += 1;
        }
      });
    }
    return {
      apps: result.sort((a, b) => a.name.localeCompare(b.name)),
      unreadable,
    };
  }

  /** A versão instalada de uma app (null se não estiver lá). */
  async function appVersion(id: string): Promise<string | null> {
    const info = (
      await get<OcsResponse<{ version?: string }>>(
        `/ocs/v2.php/cloud/apps/${encodeURIComponent(id)}?format=json`,
      )
    ).ocs?.data;
    return info?.version ? cleanVersion(info.version) : null;
  }

  return { status, me, apps, appsRead, appVersion };
}

/** O cliente de uma conta Nextcloud ligada (já desencriptada): a raiz, o utilizador e a password de app. */
export const nextcloudForAccount = (account: ConnectedAccount) =>
  createNextcloudClient(
    account.baseUrl ?? account.caldavUrl ?? '',
    account.caldavUsername ?? '',
    account.caldavPassword ?? '',
  );

/** As apps da App Store para uma versão do servidor ("31.0.5"), com a versão estável mais recente de cada uma. */
export async function nextcloudStoreApps(
  serverVersion: string,
): Promise<Map<string, NextcloudStoreApp>> {
  const platform = cleanVersion(serverVersion)
    .split('.')
    .concat(['0', '0'])
    .slice(0, 3)
    .join('.');
  const cached = storeCache.get(platform);
  if (cached && Date.now() - cached.at < STORE_CACHE_MS) return cached.apps;

  const response = await fetch(
    `https://apps.nextcloud.com/api/v1/platform/${platform}/apps.json`,
    {
      headers: { Accept: 'application/json', 'User-Agent': 'MyHomeLab' },
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) {
    throw new Error(`A App Store do Nextcloud respondeu ${response.status}`);
  }
  const list = (await response.json()) as {
    id: string;
    website?: string;
    issueTracker?: string;
    translations?: { en?: { name?: string } };
    releases?: {
      version: string;
      isNightly?: boolean;
      created?: string;
      translations?: { en?: { changelog?: string } };
    }[];
  }[];
  const apps = new Map<string, NextcloudStoreApp>();
  for (const app of list) {
    const releases = (app.releases ?? [])
      .filter(
        (release) =>
          !release.isNightly && !/-(alpha|beta|rc)/i.test(release.version),
      )
      .sort((a, b) => compareVersions(b.version, a.version))
      .map((release) => ({
        version: cleanVersion(release.version),
        created: release.created ?? null,
        changelog: release.translations?.en?.changelog?.trim() ?? '',
      }));
    const latest = releases[0]?.version;
    if (!latest) continue;
    apps.set(app.id, {
      id: app.id,
      name: app.translations?.en?.name ?? app.id,
      latest,
      website: app.website || null,
      issueTracker: app.issueTracker || null,
      releases,
    });
  }
  storeCache.set(platform, { at: Date.now(), apps });
  return apps;
}

/** As apps instaladas que têm versão mais recente na App Store. */
export function nextcloudAppUpdates(
  installed: NextcloudApp[],
  store: Map<string, NextcloudStoreApp>,
): NextcloudAppUpdate[] {
  return installed.flatMap((app) => {
    const listed = store.get(app.id);
    if (!listed || compareVersions(listed.latest, app.version) <= 0) return [];
    return [
      {
        id: app.id,
        name: app.name,
        installed: app.version,
        latest: listed.latest,
        releaseUrl: `https://apps.nextcloud.com/apps/${app.id}`,
        website: listed.website,
      },
    ];
  });
}
