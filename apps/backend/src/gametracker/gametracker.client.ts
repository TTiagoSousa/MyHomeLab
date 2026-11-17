import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

// O GamesTracker Vault (a prateleira de jogos self-hosted): a API REST em <endereço>/api,
// com um token pessoal "gtv_…" (Definições → API → Novo token). O token age como quem o
// criou: de um admin chega aos backups e à versão; só de leitura, só faz GET.

/** O repositório das releases (as notas e as issues das atualizações). */
export const GAMETRACKER_REPOSITORY = 'TTiagoSousa/GamesTracker-Vault';

export const GAME_STATUSES = [
  'PLAYING',
  'PAUSED',
  'PLAN_TO_PLAY',
  'FINISHED_MAIN',
  'FINISHED_EXTRAS',
  'COMPLETED_100',
  'DROPPED',
] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const SHELVES = ['playing', 'finished', 'planned', 'dropped'] as const;

export interface GameSummary {
  id: number;
  name: string;
  coverUrl?: string | null;
  year?: number | null;
  platforms?: string[];
}

export interface ShelfEntry {
  gameId: number;
  status: GameStatus;
  hoursPlayed: number | null;
  rating: number | null;
  notes: string | null;
  platform: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt?: string;
  game?: GameSummary;
}

export interface ShelfEntryInput {
  status: GameStatus;
  hoursPlayed?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  rating?: number | null;
  notes?: string | null;
  platform?: string | null;
}

export interface GamePrice {
  provider: string;
  currency: string;
  price: number;
  regular: number;
  cut: number;
  shop: string;
  url: string;
  lowest: number | null;
  isLowest: boolean;
}

export interface GameTrackerMe {
  id: string;
  username: string;
  role: string;
  authMethod: string;
  isAdmin: boolean;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });

export const normalizeGameTrackerUrl = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

function failure(error: unknown, what: string): AppIntegrationError {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const body = error.response.data as { message?: unknown } | undefined;
    const message = Array.isArray(body?.message)
      ? body.message.join('; ')
      : typeof body?.message === 'string'
        ? body.message
        : '';
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O GamesTracker recusou o token (expirou, foi revogado ou não existe). Cria outro em Definições → API.',
      );
    }
    if (status === 403) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O GamesTracker não deixou (${what})${message ? `: ${message}` : ''}. Um token só de leitura não muda nada; os backups e a versão precisam do token de um admin.`,
      );
    }
    return new AppIntegrationError(
      status === 404 ? 'APP_NOT_SUPPORTED' : 'APP_UNREACHABLE',
      `O GamesTracker respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o GamesTracker: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** A saúde, sem token: se é mesmo um GamesTracker e a versão instalada. */
export async function gameTrackerHealth(baseUrl: string) {
  try {
    const { data } = await axios.get<{
      app?: string;
      ok?: boolean;
      version?: string | null;
    }>(`${normalizeGameTrackerUrl(baseUrl)}/api/health`, {
      httpsAgent,
      timeout: 15_000,
    });
    if (data?.app !== 'gametracker-vault') {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não é um GamesTracker Vault (o /api/health não o diz).',
      );
    }
    return { ok: Boolean(data.ok), version: data.version ?? null };
  } catch (error) {
    throw failure(error, '/health');
  }
}

/** A versão instalada (do /api/health, sem token). */
export async function gameTrackerVersion(baseUrl: string): Promise<string> {
  const { version } = await gameTrackerHealth(baseUrl);
  if (!version) {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      'O GamesTracker não diz a versão (sem informação do git).',
    );
  }
  return version;
}

export function createGameTrackerClient(baseUrl: string, token: string) {
  const http = axios.create({
    baseURL: `${normalizeGameTrackerUrl(baseUrl)}/api`,
    httpsAgent,
    timeout: 30_000,
    headers: { Authorization: `Bearer ${token}` },
  });
  const call = async <T>(what: string, run: () => Promise<{ data: T }>) => {
    try {
      return (await run()).data;
    } catch (error) {
      throw failure(error, what);
    }
  };

  return {
    me: () => call('/auth/me', () => http.get<GameTrackerMe>('/auth/me')),
    library: (filter: { shelf?: string; status?: string } = {}) =>
      call('/library', () =>
        http.get<{
          items: ShelfEntry[];
          counts: Record<GameStatus, number>;
          total: number;
        }>('/library', { params: filter }),
      ),
    stats: () =>
      call('/library/stats', () =>
        http.get<Record<string, unknown>>('/library/stats'),
      ),
    entry: (gameId: number) =>
      call('/library/:gameId', () =>
        http.get<{ entry: ShelfEntry | null }>(`/library/${gameId}`),
      ),
    setEntry: (gameId: number, input: ShelfEntryInput) =>
      call('PUT /library/:gameId', () =>
        http.put<{ entry: ShelfEntry }>(`/library/${gameId}`, input),
      ),
    removeEntry: (gameId: number) =>
      call('DELETE /library/:gameId', () =>
        http.delete<{ entry: null }>(`/library/${gameId}`),
      ),
    search: (query: string, pageSize = 10) =>
      call('/games/search', () =>
        http.get<{ items: GameSummary[]; total: number }>('/games/search', {
          params: { q: query, pageSize },
        }),
      ),
    game: (gameId: number) =>
      call('/games/:id', () =>
        http.get<Record<string, unknown>>(`/games/${gameId}`),
      ),
    price: (gameId: number) =>
      call('/prices/games/:gameId', () =>
        http.get<{
          price: GamePrice | null;
          watch: { targetPrice: number | null } | null;
        }>(`/prices/games/${gameId}`),
      ),
    watchlist: () =>
      call('/prices/watchlist', () =>
        http.get<{
          items: {
            game: GameSummary;
            targetPrice: number | null;
            reached: boolean;
            price: GamePrice | null;
          }[];
        }>('/prices/watchlist'),
      ),
    watch: (gameId: number, targetPrice: number | null) =>
      call('PUT /prices/watchlist/:gameId', () =>
        http.put(`/prices/watchlist/${gameId}`, { targetPrice }),
      ),
    unwatch: (gameId: number) =>
      call('DELETE /prices/watchlist/:gameId', () =>
        http.delete(`/prices/watchlist/${gameId}`),
      ),
    createBackup: () =>
      call('POST /backups', () =>
        http.post<{ backup: { name: string; size: number } }>(
          '/backups',
          {},
          { timeout: 300_000 },
        ),
      ),
    downloadBackup: (name = 'latest') =>
      call('/backups/:name/download', () =>
        http.get<ArrayBuffer>(`/backups/${encodeURIComponent(name)}/download`, {
          responseType: 'arraybuffer',
          timeout: 300_000,
        }),
      ),
  };
}

export type GameTrackerClient = ReturnType<typeof createGameTrackerClient>;
