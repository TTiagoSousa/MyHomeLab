import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  createGameTrackerClient,
  GamePrice,
  GameStatus,
  GAME_STATUSES,
  ShelfEntry,
  ShelfEntryInput,
} from 'src/gametracker/gametracker.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

const STATUS_LABEL: Record<GameStatus, string> = {
  PLAYING: 'a jogar',
  PAUSED: 'em pausa',
  PLAN_TO_PLAY: 'para jogar',
  FINISHED_MAIN: 'acabado (história)',
  FINISHED_EXTRAS: 'acabado (com extras)',
  COMPLETED_100: 'a 100%',
  DROPPED: 'desistido',
};

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
  `${account.displayName ?? 'GamesTracker'} (${hostOf(account.baseUrl)})`;

/** O GamesTracker a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function gameTrackerTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.GAMETRACKER)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum GamesTracker ligado. Liga-o em Apps ligadas → GamesTracker.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o GamesTracker: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const clientOf = (account: ConnectedAccount) =>
  createGameTrackerClient(account.baseUrl ?? '', account.accessToken ?? '');

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

const priceLine = (price: GamePrice | null) =>
  !price
    ? 'sem preço nas lojas cobertas'
    : `${price.price} ${price.currency} na ${price.shop}${price.cut ? ` (−${price.cut}%, normal ${price.regular})` : ''}${price.lowest != null ? ` · mínimo de sempre ${price.lowest}${price.isLowest ? ' (é agora)' : ''}` : ''}`;

const entryLine = (entry: ShelfEntry) =>
  [
    `- ${entry.game?.name ?? `jogo ${entry.gameId}`} (id ${entry.gameId}${entry.game?.year ? `, ${entry.game.year}` : ''})`,
    STATUS_LABEL[entry.status] ?? entry.status,
    entry.hoursPlayed != null ? `${entry.hoursPlayed} h` : null,
    entry.rating != null ? `nota ${entry.rating}/10` : null,
    entry.platform,
    entry.startedAt ? `começou ${entry.startedAt}` : null,
    entry.finishedAt ? `acabou ${entry.finishedAt}` : null,
    entry.notes ? `notas: ${entry.notes.slice(0, 200)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** O resumo: versão, quem é o token, a prateleira por estado, horas, notas e géneros. */
export function overview(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [me, library, stats] = await Promise.all([
      client.me(),
      client.library(),
      client.stats(),
    ]);
    const hours = stats.hours as { total?: number } | undefined;
    const rating = stats.rating as
      { average?: number | null; rated?: number } | undefined;
    const genres = (stats.genres as { name: string; count: number }[]) ?? [];
    const playing = library.items.filter(
      (entry) => entry.status === 'PLAYING' || entry.status === 'PAUSED',
    );
    return [
      `GamesTracker ${accountLabel(account)} · versão ${account.appVersion ?? '?'}${account.appLatestVersion && account.appLatestVersion !== account.appVersion ? ` (há a ${account.appLatestVersion})` : ''}`,
      `Utilizador: ${me.username}${me.isAdmin ? ' (admin)' : ''}`,
      `Prateleira: ${library.total} jogos — ${GAME_STATUSES.map((status) => `${STATUS_LABEL[status]} ${library.counts[status] ?? 0}`).join(', ')}`,
      `Horas: ${Math.round(hours?.total ?? 0)} (as não registadas estimadas pelo IGDB)`,
      rating?.average != null
        ? `Nota média: ${rating.average} (${rating.rated ?? '?'} com nota)`
        : null,
      genres.length
        ? `Géneros: ${genres
            .slice(0, 6)
            .map((genre) => `${genre.name} ${genre.count}`)
            .join(', ')}`
        : null,
      playing.length
        ? `A jogar agora:\n${playing.map(entryLine).join('\n')}`
        : 'Nada a jogar agora.',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/** A prateleira, por estante ou por estado. */
export function listShelf(
  account: ConnectedAccount,
  input: { shelf?: string; status?: string; limit?: number },
): Promise<string> {
  return safely(async () => {
    const library = await clientOf(account).library({
      ...(input.shelf ? { shelf: input.shelf } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    if (!library.items.length) return 'Nenhum jogo com esse filtro.';
    return [
      `${library.items.length} jogos${library.items.length > limit ? ` (mostro ${limit})` : ''}:`,
      ...library.items.slice(0, limit).map(entryLine),
    ].join('\n');
  });
}

/** Procura jogos no IGDB (o id é o que entra na prateleira). */
export function searchGames(
  account: ConnectedAccount,
  input: { query: string; limit?: number },
): Promise<string> {
  return safely(async () => {
    const result = await clientOf(account).search(
      input.query,
      Math.min(Math.max(input.limit ?? 10, 1), 30),
    );
    if (!result.items.length) return `Nada no IGDB para "${input.query}".`;
    return result.items
      .map(
        (game) =>
          `- ${game.name} (id ${game.id}${game.year ? `, ${game.year}` : ''})${game.platforms?.length ? ` · ${game.platforms.slice(0, 5).join(', ')}` : ''}`,
      )
      .join('\n');
  });
}

/** Um jogo: o que diz o IGDB, como está na prateleira e o preço. */
export function gameDetail(
  account: ConnectedAccount,
  input: { game_id: number },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [game, { entry }, price] = await Promise.all([
      client.game(input.game_id),
      client.entry(input.game_id),
      client.price(input.game_id).catch(() => null),
    ]);
    const text = (key: string) =>
      typeof game[key] === 'string' ? game[key] : null;
    return [
      `${text('name') ?? `jogo ${input.game_id}`} (id ${input.game_id})`,
      text('summary') ? `Resumo: ${text('summary')!.slice(0, 600)}` : null,
      `Na prateleira: ${entry ? entryLine(entry).slice(2) : 'não está'}`,
      price
        ? `Preço: ${priceLine(price.price)}${price.watch ? ` · a seguir${price.watch.targetPrice != null ? ` (alvo ${price.watch.targetPrice})` : ''}` : ''}`
        : null,
      `Ficha completa (JSON): ${JSON.stringify(game).slice(0, 3000)}`,
    ]
      .filter(Boolean)
      .join('\n');
  });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Põe ou muda um jogo na prateleira. O GamesTracker substitui a entrada inteira (o que
 * não vai fica vazio): junta-se o que se pede ao que lá está, para não perder nada.
 */
export function setEntry(
  account: ConnectedAccount,
  input: {
    game_id: number;
    status?: GameStatus;
    hours_played?: number | null;
    rating?: number | null;
    notes?: string | null;
    platform?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const { entry: current } = await client.entry(input.game_id);
    const status = input.status ?? current?.status;
    if (!status || !GAME_STATUSES.includes(status)) {
      return `Diz o estado do jogo: ${GAME_STATUSES.join(', ')}.`;
    }
    for (const date of [input.started_at, input.finished_at]) {
      if (date && !DATE.test(date)) return 'As datas vão como AAAA-MM-DD.';
    }
    const pick = <T>(value: T | undefined, fallback: T | null | undefined) =>
      value === undefined ? (fallback ?? null) : value;
    const body: ShelfEntryInput = {
      status,
      hoursPlayed: pick(input.hours_played, current?.hoursPlayed),
      rating: pick(input.rating, current?.rating),
      notes: pick(input.notes, current?.notes),
      platform: pick(input.platform, current?.platform),
      startedAt: pick(input.started_at, current?.startedAt),
      finishedAt: pick(input.finished_at, current?.finishedAt),
    };
    const cleaned = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== null),
    ) as unknown as ShelfEntryInput;
    const { entry } = await client.setEntry(input.game_id, cleaned);
    return `${current ? 'Mudado' : 'Posto na prateleira'}: ${entryLine(entry).slice(2)}`;
  });
}

/** Tira um jogo da prateleira (só com confirm). */
export function removeEntry(
  account: ConnectedAccount,
  input: { game_id: number; confirm?: boolean },
): Promise<string> {
  return safely(async () => {
    if (!input.confirm) {
      return 'Tirar um jogo da prateleira apaga as horas, a nota e as notas dele. Confirma com ele e volta a chamar com confirm: true.';
    }
    const client = clientOf(account);
    const { entry } = await client.entry(input.game_id);
    if (!entry) return 'Esse jogo não está na prateleira.';
    await client.removeEntry(input.game_id);
    return `Tirado da prateleira: ${entry.game?.name ?? input.game_id}.`;
  });
}

/** Os jogos seguidos (alertas de preço) e os preços de agora. */
export function watchlist(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const { items } = await clientOf(account).watchlist();
    if (!items.length) return 'Não segue nenhum jogo (alertas de preço).';
    return items
      .map(
        (item) =>
          `- ${item.game.name} (id ${item.game.id}) · alvo ${item.targetPrice ?? 'qualquer promoção'}${item.reached ? ' · ATINGIDO' : ''} · ${priceLine(item.price)}`,
      )
      .join('\n');
  });
}

/** Segue um jogo (alerta de preço, com ou sem alvo) ou deixa de o seguir. */
export function watchPrice(
  account: ConnectedAccount,
  input: { game_id: number; target_price?: number | null; stop?: boolean },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    if (input.stop) {
      await client.unwatch(input.game_id);
      return `Deixou de seguir o jogo ${input.game_id}.`;
    }
    await client.watch(input.game_id, input.target_price ?? null);
    return `A seguir o jogo ${input.game_id}: avisa ${input.target_price != null ? `quando custar ${input.target_price} ou menos` : 'quando estiver em promoção'}.`;
  });
}
