import axios from 'axios';
import { Agent } from 'https';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

/** O repositório das releases do openGym (as notas e as issues das atualizações). */
export const OPENGYM_REPOSITORY = 'DuarteSantos8/openGym';

export const normalizeOpenGymUrl = (url: string) =>
  url.trim().replace(/\/+$/, '');

export interface OpenGymUser {
  id: string;
  name: string;
  admin?: boolean;
  owner?: boolean;
}

/** O estado inteiro de um perfil (o openGym guarda tudo num só documento). */
export type OpenGymState = Record<string, unknown> & {
  routines?: OpenGymRoutine[];
  workouts?: { id: string; d?: string; name?: string; routineId?: string }[];
  week?: Record<string, string | string[]>;
  customEx?: { id: string; n?: string; bp?: string }[];
  unit?: 'kg' | 'lb';
};

/** Um exercício de uma rotina: o id do catálogo e o que se faz (séries, repetições, peso, descanso). */
export interface OpenGymSlot {
  id: string;
  sets: number;
  reps?: number;
  weight?: number;
  restSec?: number;
  note?: string;
  mode?: 'time' | 'cardio';
  sec?: number;
  min?: number;
}

export interface OpenGymRoutine {
  id: string;
  name: string;
  emoji?: string;
  ex: OpenGymSlot[];
  [key: string]: unknown;
}

export interface OpenGymData {
  state: OpenGymState | null;
  rev: number;
  wid?: string;
}

const httpsAgent = new Agent({ rejectUnauthorized: false });

/** O fim de validade escrito no próprio token ("<uid>:<expira-ms>:<versão>.<hmac>"). */
export function tokenExpiry(token: string): Date | null {
  const expiry = Number(token.split('.')[0]?.split(':')[1]);
  return Number.isFinite(expiry) && expiry > 0 ? new Date(expiry) : null;
}

function failure(error: unknown, what: string): AppIntegrationError {
  if (error instanceof AppIntegrationError) return error;
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const message = (error.response.data as { error?: string } | undefined)
      ?.error;
    if (status === 401) {
      return new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O openGym já não aceita a ligação (o token expirou ou foi revogado). Emparelha outra vez com um código novo.',
      );
    }
    return new AppIntegrationError(
      status === 400 ? 'APP_AUTH_FAILED' : 'APP_UNREACHABLE',
      `O openGym respondeu ${status} em ${what}${message ? `: ${message}` : ''}`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `Não foi possível falar com o openGym: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** A saúde do servidor, sem sessão: se responde e se o disco aceita escritas. */
export async function openGymHealth(baseUrl: string) {
  try {
    const { data } = await axios.get<{
      ok?: boolean;
      users?: number;
      writable?: boolean;
    }>(`${normalizeOpenGymUrl(baseUrl)}/api/health`, {
      httpsAgent,
      timeout: 15_000,
    });
    if (typeof data !== 'object' || data?.ok === undefined) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não parece ser um openGym (não respondeu em /api/health).',
      );
    }
    return {
      ok: Boolean(data.ok),
      users: data.users ?? null,
      writable: Boolean(data.writable),
    };
  } catch (error) {
    throw failure(error, '/api/health');
  }
}

/** Troca o código de emparelhamento (Definições → emparelhar a app) por um token. */
export async function redeemOpenGymCode(baseUrl: string, code: string) {
  try {
    const { data } = await axios.post<{ token?: string; user?: OpenGymUser }>(
      `${normalizeOpenGymUrl(baseUrl)}/api/pair/redeem`,
      { code: code.trim().toUpperCase() },
      { httpsAgent, timeout: 15_000 },
    );
    if (!data?.token || !data.user) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'O openGym não devolveu o token do emparelhamento.',
      );
    }
    return { token: data.token, user: data.user };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'O código não serviu: os códigos duram 5 minutos e só servem uma vez. Gera outro no openGym.',
      );
    }
    throw failure(error, '/api/pair/redeem');
  }
}

/**
 * A versão instalada: o openGym não a diz na API, mas a página traz-a no ficheiro
 * principal ("openGym v1.4.2" em Definições → Sobre).
 */
export async function openGymVersion(baseUrl: string): Promise<string> {
  const root = normalizeOpenGymUrl(baseUrl);
  const get = async (path: string) =>
    String(
      (
        await axios.get<string>(`${root}/${path}`, {
          httpsAgent,
          timeout: 30_000,
          responseType: 'text',
        })
      ).data,
    );
  try {
    const script = /src="\.?\/?(assets\/index-[^"]+\.js)"/.exec(
      await get(''),
    )?.[1];
    if (!script)
      throw new Error('não encontrei o ficheiro principal da página');
    const main = await get(script);
    const found = versionIn(main);
    if (found) return found;
    // Desde a 1.4.4 as Definições (onde está a versão) carregam à parte: procura nos
    // ficheiros que o principal importa, os das Definições primeiro.
    const chunks = [
      ...new Set(
        [...main.matchAll(/"\.\/([\w.-]+\.js)"/g)].map((match) => match[1]),
      ),
    ].sort((a, b) => Number(/^Settings/.test(b)) - Number(/^Settings/.test(a)));
    for (const chunk of chunks.slice(0, 80)) {
      const version = versionIn(await get(`assets/${chunk}`).catch(() => ''));
      if (version) return version;
    }
    throw new Error('a página não diz a versão');
  } catch (error) {
    throw failure(error, 'a página');
  }
}

/** A versão de Definições → Sobre ("openGym v", "1.4.4"), num ficheiro da página. */
export const versionIn = (text: string) =>
  /`openGym v`,`(\d+\.\d+\.\d+)[^`]*`/.exec(text)?.[1] ??
  /value:`v(\d+\.\d+\.\d+)[^`]*`/.exec(text)?.[1] ??
  null;

/** O cliente de um perfil openGym emparelhado (o token é o da app do telemóvel). */
export function createOpenGymClient(baseUrl: string, token: string) {
  const http = axios.create({
    baseURL: `${normalizeOpenGymUrl(baseUrl)}/api`,
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
    /** Quem é o perfil; a meio da validade o openGym devolve um token novo. */
    me: () =>
      call('/api/me', () =>
        http.get<{ user: OpenGymUser; token?: string }>('/me'),
      ),
    data: () => call('/api/data', () => http.get<OpenGymData>('/data')),
    /**
     * Grava o estado com a revisão lida (sem `stamped`: o openGym marca ele o que
     * mudou, e nunca apaga o que este documento não tiver).
     */
    saveData: (state: OpenGymState, baseRev: number, baseWid?: string) =>
      call('/api/data', () =>
        http.put<{ ok: boolean; rev: number; wid?: string }>('/data', {
          state,
          baseRev,
          ...(baseWid ? { baseWid } : {}),
        }),
      ),
  };
}

export type OpenGymClient = ReturnType<typeof createOpenGymClient>;
