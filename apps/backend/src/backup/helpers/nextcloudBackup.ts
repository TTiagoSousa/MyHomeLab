import { createReadStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { Agent } from 'https';
import { tmpdir } from 'os';
import { join } from 'path';
import axios from 'axios';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { davResponses, tagText } from 'src/nextcloud/davXml';
import {
  nextcloudForAccount,
  nextcloudRoot,
} from 'src/nextcloud/nextcloud.client';
import { BackupFile } from './backupSources';
import { TarEntry, writeTar } from './writeTar';

const PROPFIND = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>`;

interface OcsResponse<T> {
  ocs?: { data?: T };
}

/** Um nome que serve de ficheiro: sem barras nem caracteres esquisitos. */
const fileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'sem-nome';

/**
 * O backup do Nextcloud: um .tar com os calendários e as listas de tarefas (.ics,
 * um por calendário), os livros de contactos (.vcf) da conta ligada e um
 * nextcloud.json com a versão, as apps ligadas e, com uma conta de
 * administrador, os utilizadores e os grupos. Tudo pela API, sem mexer na máquina.
 *
 * Não leva os ficheiros nem a base de dados: para isso o backup da máquina no
 * Proxmox. Dos outros utilizadores só entram os calendários partilhados com esta conta
 * (a password de app só abre o que a conta vê).
 */
export async function nextcloudBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.caldavUsername || !account.caldavPassword) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'A conta Nextcloud já não tem password de app. Liga-a outra vez em Apps ligadas.',
    );
  }
  const client = nextcloudForAccount(account);
  const http = axios.create({
    baseURL: nextcloudRoot(account.baseUrl ?? account.caldavUrl ?? ''),
    auth: {
      username: account.caldavUsername,
      password: account.caldavPassword,
    },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 120_000,
    responseType: 'text',
    transformResponse: (data: unknown) => data,
    headers: { 'OCS-APIRequest': 'true' },
  });

  const [status, me] = await Promise.all([client.status(), client.me()]);
  const user = encodeURIComponent(me.id);
  const entries: TarEntry[] = [];
  const missing: string[] = [];

  /** As coleções (calendários ou livros) de uma pasta DAV, com o endereço e o nome. */
  const collections = async (home: string, kind: RegExp) => {
    const response = await http.request<string>({
      method: 'PROPFIND',
      url: home,
      headers: { Depth: '1', 'Content-Type': 'application/xml' },
      data: PROPFIND,
    });
    return davResponses(response.data).flatMap((part) => {
      const href = tagText(part, 'href');
      if (!href || !kind.test(tagText(part, 'resourcetype') ?? '')) return [];
      const slug = decodeURIComponent(
        href.replace(/\/+$/, '').split('/').pop() ?? '',
      );
      return [{ href, name: tagText(part, 'displayname') || slug, slug }];
    });
  };

  /** Exporta cada coleção inteira (o "?export" do Nextcloud) para dentro do .tar. */
  const exportAll = async (
    label: string,
    home: string,
    kind: RegExp,
    folder: string,
    extension: string,
  ) => {
    let found: { href: string; name: string; slug: string }[];
    try {
      found = await collections(home, kind);
    } catch {
      missing.push(`${label} (lista)`);
      return [];
    }
    for (const item of found) {
      try {
        const body = (await http.get<string>(`${item.href}?export`)).data;
        entries.push({
          name: `${folder}/${fileName(item.slug)}.${extension}`,
          content: Buffer.from(body),
        });
      } catch {
        missing.push(`${label}: ${item.name}`);
      }
    }
    return found.map((item) => ({
      name: item.name,
      file: `${folder}/${fileName(item.slug)}.${extension}`,
    }));
  };

  const calendars = await exportAll(
    'calendários',
    `/remote.php/dav/calendars/${user}/`,
    /<(?:[a-z0-9-]+:)?calendar\s*\/>/i,
    'calendars',
    'ics',
  );
  const addressBooks = await exportAll(
    'contactos',
    `/remote.php/dav/addressbooks/users/${user}/`,
    /<(?:[a-z0-9-]+:)?addressbook\s*\/>/i,
    'contacts',
    'vcf',
  );

  const ocs = async <T>(path: string, name: string): Promise<T | null> => {
    try {
      const body = (
        await http.get<string>(`/ocs/v2.php${path}`, {
          headers: { Accept: 'application/json' },
        })
      ).data;
      return (JSON.parse(body) as OcsResponse<T>).ocs?.data ?? null;
    } catch {
      missing.push(name);
      return null;
    }
  };
  // Sem administrador o Nextcloud não diz as apps, os utilizadores nem os grupos.
  const apps = me.isAdmin
    ? await client.apps().catch(() => {
        missing.push('apps');
        return [];
      })
    : [];
  const users = me.isAdmin
    ? ((
        await ocs<{ users?: string[] }>(
          '/cloud/users?format=json',
          'utilizadores',
        )
      )?.users ?? [])
    : [];
  const groups = me.isAdmin
    ? ((await ocs<{ groups?: string[] }>('/cloud/groups?format=json', 'grupos'))
        ?.groups ?? [])
    : [];

  entries.unshift({
    name: 'nextcloud.json',
    content: Buffer.from(
      JSON.stringify(
        {
          instance: nextcloudRoot(account.baseUrl ?? account.caldavUrl ?? ''),
          version: status.version,
          user: me.id,
          admin: me.isAdmin,
          createdAt: new Date().toISOString(),
          calendars,
          addressBooks,
          apps,
          users,
          groups,
        },
        null,
        2,
      ),
    ),
  });

  const folder = await mkdtemp(join(tmpdir(), 'myhomelab-nextcloud-'));
  const cleanup = () => rm(folder, { recursive: true, force: true });
  try {
    const tarPath = join(folder, 'nextcloud.tar');
    const sizeBytes = await writeTar(tarPath, entries);
    return { content: createReadStream(tarPath), sizeBytes, missing, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
