import { BadRequestException } from '@nestjs/common';

/** Uma série como o openGym a guarda (só os campos que se usam). */
export interface OpenGymSet {
  w?: number;
  r?: number;
  sec?: number;
  done?: boolean;
  warmup?: boolean;
  phase?: string;
  at?: number;
  rir?: number;
  rpe?: number;
}

interface OpenGymTarget {
  mode?: string;
  sets?: number;
  reps?: number;
  sec?: number;
  weight?: number;
}

export interface OpenGymEntry {
  id: string;
  sets?: OpenGymSet[];
  planned?: OpenGymTarget;
  target?: OpenGymTarget;
}

export interface OpenGymWorkout {
  id: string;
  d: string;
  start?: number;
  end?: number;
  name?: string;
  entries?: OpenGymEntry[];
  prs?: string[];
  vol?: number;
}

export interface OpenGymCustomExercise {
  id: string;
  n?: string;
  bp?: string;
}

/** O estado do openGym (um documento por utilizador), só com o que se lê. */
export interface OpenGymState {
  unit?: string;
  workouts?: OpenGymWorkout[];
  customEx?: OpenGymCustomExercise[];
}

export interface OpenGymUser {
  id: string;
  name: string;
}

/** O catálogo de exercícios do openGym, no repositório deles (um JSON por exercício). */
const CATALOGUE_URL =
  'https://raw.githubusercontent.com/DuarteSantos8/openGym/main/catalogue/exercises';

const TIMEOUT_MS = 20_000;

/** O endereço sem barra no fim e sem caminho (https://opengym.exemplo.com). */
export function openGymBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException({
      code: 'OPENGYM_URL',
      message: 'O endereço do openGym não é válido.',
    });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException({
      code: 'OPENGYM_URL',
      message: 'O endereço do openGym tem de começar por https://.',
    });
  }
  return url.origin;
}

/** Um erro do openGym com a mensagem que se mostra ao utilizador. */
export class OpenGymError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: { token?: string; method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new OpenGymError(`Não consegui chegar ao openGym em ${baseUrl}.`);
  }
  if (response.status === 401) {
    throw new OpenGymError(
      'O openGym recusou a ligação (a sessão expirou ou foi terminada). Volta a ligar com um código novo.',
      401,
    );
  }
  if (!response.ok) {
    throw new OpenGymError(
      `O openGym respondeu com erro ${response.status}.`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/** Troca o código de emparelhamento (8 letras, 5 minutos) pelo token da sessão. */
export async function redeemOpenGymCode(baseUrl: string, code: string) {
  try {
    return await request<{ token: string; user: OpenGymUser }>(
      baseUrl,
      '/api/pair/redeem',
      { method: 'POST', body: { code: code.trim().toUpperCase() } },
    );
  } catch (error) {
    if (error instanceof OpenGymError && error.status === 400) {
      throw new OpenGymError(
        'O código não é válido: já foi usado ou passaram os 5 minutos. Gera outro no openGym.',
        400,
      );
    }
    throw error;
  }
}

/**
 * Quem é o utilizador do token. Passada metade da validade, o openGym devolve
 * um token novo, que passa a ser o que se usa.
 */
export function openGymMe(baseUrl: string, token: string) {
  return request<{ user: OpenGymUser; token?: string }>(baseUrl, '/api/me', {
    token,
  });
}

/** Só a revisão do estado: se não mudou, não é preciso ler tudo. */
export function openGymRev(baseUrl: string, token: string) {
  return request<{ rev: number }>(baseUrl, '/api/data/rev', { token });
}

export function openGymData(baseUrl: string, token: string) {
  return request<{ state: OpenGymState; rev: number }>(baseUrl, '/api/data', {
    token,
  });
}

/** Um exercício do catálogo do openGym; null se não existir ou não se conseguir ler. */
export async function openGymCatalogueExercise(id: string) {
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    const response = await fetch(`${CATALOGUE_URL}/${id}.json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : null;
    const name = text(data.name);
    if (!name) return null;
    return {
      id,
      name,
      bodyPart: text(data.bodyPart),
      target: text(data.target),
      equipment: text(data.equipment),
      category: text(data.category),
    };
  } catch {
    return null;
  }
}
