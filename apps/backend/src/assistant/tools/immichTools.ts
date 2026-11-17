import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  createImmichClient,
  ImmichAsset,
  ImmichManualJob,
  ImmichQueue,
  ImmichSearchFilter,
} from 'src/immich/immich.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : '?';
  } catch {
    return '?';
  }
};

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'Immich'} (${hostOf(account.baseUrl)})`;

/** O Immich a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function immichTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.IMMICH)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Immich ligado. Liga-o em Apps ligadas → Immich.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Immich: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const clientOf = (account: ConnectedAccount) =>
  createImmichClient(account.baseUrl ?? '', account.accessToken ?? '');

const describeError = (error: unknown) =>
  error instanceof AppIntegrationError || error instanceof Error
    ? error.message
    : String(error);

const safely = async (work: () => Promise<string>) => {
  try {
    return await work();
  } catch (error) {
    return `Falhou: ${describeError(error)}`;
  }
};

const gigabytes = (bytes: number) =>
  `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`;

const assetLine = (asset: ImmichAsset) =>
  [
    `- ${asset.originalFileName} (${asset.id})`,
    asset.type === 'VIDEO'
      ? 'vídeo'
      : asset.type === 'IMAGE'
        ? 'foto'
        : asset.type,
    (asset.localDateTime ?? asset.fileCreatedAt)?.slice(0, 10),
    [asset.exifInfo?.city, asset.exifInfo?.country]
      .filter(Boolean)
      .join(', ') || null,
    asset.people?.length
      ? `com ${asset.people.map((person) => person.name || '?').join(', ')}`
      : null,
    asset.isFavorite ? '★ favorita' : null,
    asset.visibility && asset.visibility !== 'timeline'
      ? asset.visibility
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** O resumo: versão, quem é a chave, fotos e vídeos, disco e as filas com trabalho. */
export function overview(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [me, storage, mine] = await Promise.all([
      client.me(),
      client.storage(),
      client.myStatistics(),
    ]);
    const [statistics, queues] = me.isAdmin
      ? await Promise.all([
          client.statistics().catch(() => null),
          client.queues().catch(() => null),
        ])
      : [null, null];
    const busy = (queues ?? []).filter(
      (queue) =>
        queue.isPaused ||
        queue.statistics.active ||
        queue.statistics.waiting ||
        queue.statistics.failed,
    );
    return [
      `Immich ${accountLabel(account)} · versão ${account.appVersion ?? '?'}${account.appLatestVersion && account.appLatestVersion !== account.appVersion ? ` (há a ${account.appLatestVersion})` : ''}`,
      `Chave de: ${me.name} <${me.email}>${me.isAdmin ? ' (admin)' : ''}`,
      `As fotos dele: ${mine.images} fotos e ${mine.videos} vídeos`,
      statistics
        ? `No servidor: ${statistics.photos} fotos, ${statistics.videos} vídeos, ${gigabytes(statistics.usage)} — ${statistics.usageByUser.map((user) => `${user.userName} ${gigabytes(user.usage)}`).join(', ')}`
        : null,
      `Disco: ${storage.diskUse} de ${storage.diskSize} (${storage.diskUsagePercentage.toFixed(0)}%), livres ${storage.diskAvailable}`,
      queues
        ? busy.length
          ? `Filas com trabalho:\n${busy
              .map(
                (queue) =>
                  `- ${queue.name}${queue.isPaused ? ' (em pausa)' : ''}: ${queue.statistics.active} a correr, ${queue.statistics.waiting} à espera, ${queue.statistics.failed} falhadas`,
              )
              .join('\n')}`
          : 'Filas: tudo parado e sem falhas.'
        : me.isAdmin
          ? null
          : 'Filas e definições do servidor: só com a chave de um admin.',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/** Procura fotos e vídeos: com texto, pela pesquisa inteligente; sem ele, pelos metadados. */
export function searchAssets(
  account: ConnectedAccount,
  input: {
    query?: string;
    taken_after?: string;
    taken_before?: string;
    city?: string;
    country?: string;
    type?: 'IMAGE' | 'VIDEO';
    favorite?: boolean;
    person_ids?: string[];
    file_name?: string;
    limit?: number;
  },
): Promise<string> {
  return safely(async () => {
    const size = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const filter: ImmichSearchFilter = {
      ...(input.query?.trim() ? { query: input.query.trim() } : {}),
      ...(input.taken_after ? { takenAfter: input.taken_after } : {}),
      ...(input.taken_before ? { takenBefore: input.taken_before } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.favorite !== undefined ? { isFavorite: input.favorite } : {}),
      ...(input.person_ids?.length ? { personIds: input.person_ids } : {}),
      ...(input.file_name ? { originalFileName: input.file_name } : {}),
      size,
    };
    const { assets } = await clientOf(account).search(filter);
    if (!assets.items.length) return 'Nada com essa pesquisa.';
    return [
      `${assets.items.length} ${assets.items.length === 1 ? 'resultado' : 'resultados'}${assets.total > assets.items.length ? ` (de ${assets.total})` : ''}${filter.query ? ' — pesquisa inteligente, os primeiros são os mais parecidos' : ''}:`,
      ...assets.items.map(assetLine),
    ].join('\n');
  });
}

/** Os álbuns, com quantas fotos e as datas. */
export function listAlbums(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const albums = await clientOf(account).albums();
    if (!albums.length) return 'Não há álbuns.';
    return [
      `${albums.length} álbuns:`,
      ...albums
        .sort((a, b) => a.albumName.localeCompare(b.albumName))
        .map(
          (album) =>
            `- ${album.albumName} (${album.id}) · ${album.assetCount} itens${album.startDate ? ` · ${album.startDate.slice(0, 10)}${album.endDate ? ` a ${album.endDate.slice(0, 10)}` : ''}` : ''}${album.shared ? ' · partilhado' : ''}${album.description ? ` · ${album.description.slice(0, 120)}` : ''}`,
        ),
    ].join('\n');
  });
}

/** Um álbum e as fotos dele. */
export function albumDetail(
  account: ConnectedAccount,
  input: { album_id: string; limit?: number },
): Promise<string> {
  return safely(async () => {
    const album = await clientOf(account).album(input.album_id);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const assets = album.assets ?? [];
    return [
      `${album.albumName} (${album.id}) · ${album.assetCount} itens${album.shared ? ' · partilhado' : ''}`,
      album.description ? `Descrição: ${album.description}` : null,
      assets.length
        ? [
            `Itens${assets.length > limit ? ` (mostro ${limit})` : ''}:`,
            ...assets.slice(0, limit).map(assetLine),
          ].join('\n')
        : 'Sem itens.',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/** Cria um álbum, ou muda o nome, a descrição e as fotos de um que existe. */
export function saveAlbum(
  account: ConnectedAccount,
  input: {
    album_id?: string;
    name?: string;
    description?: string;
    add_assets?: string[];
    remove_assets?: string[];
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    if (!input.album_id) {
      if (!input.name?.trim()) return 'Para criar um álbum falta o nome.';
      const album = await client.createAlbum({
        albumName: input.name.trim(),
        ...(input.description ? { description: input.description } : {}),
        ...(input.add_assets?.length ? { assetIds: input.add_assets } : {}),
      });
      return `Criei o álbum «${album.albumName}» (${album.id}) com ${album.assetCount} itens.`;
    }
    const before = await client.album(input.album_id);
    const lines: string[] = [];
    if (input.name?.trim() || input.description !== undefined) {
      await client.updateAlbum(input.album_id, {
        ...(input.name?.trim() ? { albumName: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      });
      lines.push(
        `Antes: nome «${before.albumName}», descrição «${before.description}».`,
      );
    }
    const report = (
      results: { id: string; success: boolean; error?: string }[],
      verb: string,
    ) => {
      const ok = results.filter((item) => item.success).length;
      const failed = results.filter((item) => !item.success);
      return `${verb} ${ok}${failed.length ? `; ${failed.length} não (${[...new Set(failed.map((item) => item.error ?? '?'))].join(', ')})` : ''}.`;
    };
    if (input.add_assets?.length) {
      lines.push(
        report(
          await client.addToAlbum(input.album_id, input.add_assets),
          'Acrescentei',
        ),
      );
    }
    if (input.remove_assets?.length) {
      lines.push(
        report(
          await client.removeFromAlbum(input.album_id, input.remove_assets),
          'Tirei do álbum (as fotos ficam no Immich)',
        ),
      );
    }
    if (!lines.length) return 'Não há nada a mudar no álbum.';
    return [`Álbum «${before.albumName}» (${before.id}):`, ...lines].join('\n');
  });
}

/** As pessoas reconhecidas (com nome primeiro). */
export function listPeople(
  account: ConnectedAccount,
  input: { query?: string; limit?: number },
): Promise<string> {
  return safely(async () => {
    const { people, total, hidden } = await clientOf(account).people();
    const needle = input.query?.trim() ? normalize(input.query) : '';
    const found = people
      .filter((person) => !needle || normalize(person.name).includes(needle))
      .sort((a, b) => Number(!a.name) - Number(!b.name));
    const limit = Math.min(Math.max(input.limit ?? 60, 1), 300);
    if (!found.length) return 'Ninguém com esse nome.';
    return [
      `${total} pessoas (${hidden} escondidas, ${people.filter((person) => !person.name).length} sem nome):`,
      ...found
        .slice(0, limit)
        .map(
          (person) =>
            `- ${person.name || '(sem nome)'} (${person.id})${person.birthDate ? ` · nasceu ${person.birthDate}` : ''}${person.isHidden ? ' · escondida' : ''}`,
        ),
    ].join('\n');
  });
}

/** Dá nome a uma pessoa, a data de nascimento, ou esconde-a. */
export function updatePerson(
  account: ConnectedAccount,
  input: {
    person_id: string;
    name?: string;
    birth_date?: string | null;
    hidden?: boolean;
  },
): Promise<string> {
  return safely(async () => {
    const person = await clientOf(account).updatePerson(input.person_id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.birth_date !== undefined
        ? { birthDate: input.birth_date }
        : {}),
      ...(input.hidden !== undefined ? { isHidden: input.hidden } : {}),
    });
    return `Pessoa ${person.id}: nome «${person.name}»${person.birthDate ? `, nasceu ${person.birthDate}` : ''}${person.isHidden ? ', escondida' : ''}.`;
  });
}

/** Os grupos de duplicados que o Immich encontrou. */
export function listDuplicates(
  account: ConnectedAccount,
  input: { limit?: number },
): Promise<string> {
  return safely(async () => {
    const groups = await clientOf(account).duplicates();
    if (!groups.length) {
      return 'Sem duplicados (ou a deteção ainda não correu: fila duplicateDetection).';
    }
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    return [
      `${groups.length} grupos de duplicados${groups.length > limit ? ` (mostro ${limit})` : ''}. Resolver é na página Utilidades → Duplicados do Immich; daqui não apago fotos.`,
      ...groups
        .slice(0, limit)
        .map(
          (group) =>
            `Grupo ${group.duplicateId}:\n${group.assets.map(assetLine).join('\n')}`,
        ),
    ].join('\n');
  });
}

/** As filas de tarefas (miniaturas, rostos, pesquisa…), com o que corre e o que falhou. */
export function listQueues(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const queues = await clientOf(account).queues();
    return queues
      .map(
        (queue) =>
          `- ${queue.name}${queue.isPaused ? ' (em pausa)' : ''}: ${queue.statistics.active} a correr, ${queue.statistics.waiting} à espera, ${queue.statistics.delayed} adiadas, ${queue.statistics.failed} falhadas`,
      )
      .join('\n');
  });
}

/** Corre uma fila (as em falta, ou tudo com force), pausa-a ou retoma-a; ou lança uma tarefa à mão. */
export function runJob(
  account: ConnectedAccount,
  input: {
    queue?: ImmichQueue;
    action?: 'start' | 'pause' | 'resume';
    force?: boolean;
    job?: ImmichManualJob;
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    if (input.job) {
      await client.runJob(input.job);
      return `Lancei a tarefa ${input.job}.`;
    }
    if (!input.queue) return 'Diz a fila (queue) ou a tarefa (job).';
    const action = input.action ?? 'start';
    if (action === 'pause' || action === 'resume') {
      const queue = await client.setQueuePaused(
        input.queue,
        action === 'pause',
      );
      return `A fila ${queue.name} está ${queue.isPaused ? 'em pausa' : 'a correr'}.`;
    }
    await client.startQueue(input.queue, Boolean(input.force));
    return `Pus a correr a fila ${input.queue}${input.force ? ' para tudo (refaz o que já estava feito)' : ' para o que está em falta'}.`;
  });
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** O valor de um caminho com pontos ("backup.database.enabled"). */
const valueAt = (config: Record<string, unknown>, path: string): unknown =>
  path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (current, key) => (isObject(current) ? current[key] : undefined),
      config,
    );

/** O que muda: junta o patch à configuração e lista cada folha que fica diferente. */
function mergeConfig(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  prefix = '',
  changes: { path: string; before: unknown; after: unknown }[] = [],
) {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in base)) {
      throw new Error(
        `O Immich não tem a definição ${path}. Vê as que existem com immich_settings.`,
      );
    }
    if (isObject(value) && isObject(base[key])) {
      merged[key] = mergeConfig(base[key], value, path, changes).merged;
    } else {
      if (JSON.stringify(base[key]) !== JSON.stringify(value)) {
        changes.push({ path, before: base[key], after: value });
      }
      merged[key] = value;
    }
  }
  return { merged, changes };
}

/** As definições do servidor (Administração → Definições), inteiras ou uma parte. */
export function readSettings(
  account: ConnectedAccount,
  input: { section?: string },
): Promise<string> {
  return safely(async () => {
    const config = await clientOf(account).config();
    if (!input.section?.trim()) {
      return [
        'As partes das definições (pede uma com section, ex.: "backup", "machineLearning.facialRecognition"):',
        ...Object.entries(config).map(
          ([key, value]) =>
            `- ${key}${isObject(value) ? `: ${Object.keys(value).join(', ')}` : ` = ${JSON.stringify(value)}`}`,
        ),
      ].join('\n');
    }
    const value = valueAt(config, input.section.trim());
    if (value === undefined) {
      return `Não há a parte ${input.section}. As que há: ${Object.keys(config).join(', ')}.`;
    }
    return `${input.section}:\n${JSON.stringify(value, null, 2)}`;
  });
}

/**
 * Muda definições do servidor: junta o patch à configuração atual (só muda o que vem
 * nele) e devolve o valor de antes de cada uma, para se poder desfazer.
 */
export function changeSettings(
  account: ConnectedAccount,
  input: { changes: Record<string, unknown>; confirm?: boolean },
): Promise<string> {
  return safely(async () => {
    if (!isObject(input.changes) || !Object.keys(input.changes).length) {
      return 'Falta o que mudar (changes), ex.: {"backup":{"database":{"keepLastAmount":30}}}.';
    }
    const client = clientOf(account);
    const current = await client.config();
    const { merged, changes } = mergeConfig(current, input.changes);
    if (!changes.length) return 'Já estava assim: nada mudou.';
    const list = changes
      .map(
        (change) =>
          `- ${change.path}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
      )
      .join('\n');
    if (!input.confirm) {
      return `Isto muda:\n${list}\nConfirma com ele e volta a chamar com confirm: true.`;
    }
    await client.setConfig(merged);
    return `Mudei:\n${list}\nPara desfazer, volta a pôr os valores da esquerda.`;
  });
}
