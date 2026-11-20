import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  AppRelease,
  cleanVersion,
  compareVersions,
} from 'src/integrations/releases';

// O ClickHouse pela interface HTTP (porta 8123, ou 8443 com TLS; muitas vezes atrás de um
// proxy com HTTPS). O SQL vai no corpo de um POST para a raiz ("/"), o utilizador e a password
// nos cabeçalhos X-ClickHouse-User / X-ClickHouse-Key e as definições (readonly,
// max_result_rows, …) nos parâmetros do endereço. /ping responde "Ok." sem login. A interface
// web /play é só uma página: o endereço colado com /play fica sem ele. O MCP oficial
// (mcp-clickhouse) é um programa Python à parte (stdio): não se usa, ficam as clickhouse_*.

export const CLICKHOUSE_REPOSITORY = 'ClickHouse/ClickHouse';

/** Tira o que se cola a mais: espaços, a barra do fim, o /play (ou /dashboard) e a query. */
export const normalizeClickhouseUrl = (url: string) =>
  url
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/(play|dashboard|ping)(\/.*)?$/i, '')
    .replace(/\/+$/, '');

export interface ClickhouseResult<T = Record<string, unknown>> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
  rows_before_limit_at_least?: number;
  statistics?: { elapsed: number; rows_read: number; bytes_read: number };
}

/** Os números grandes (UInt64) vêm como texto no JSON: aqui passam a número. */
export const num = (value: unknown) =>
  typeof value === 'number' ? value : Number(value ?? 0) || 0;

/** "1.2 GiB" a partir de bytes. */
export function bytes(value: unknown): string {
  let size = num(value);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

/** Um nome entre crases, para meter no SQL sem injeção. */
export const quoteName = (name: string) =>
  `\`${name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;

/** Um texto entre plicas, para meter no SQL sem injeção. */
export const quoteText = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const AUTH_CODES = new Set([192, 193, 194, 516]);
const READONLY_CODE = 164;

/** O erro do ClickHouse ("Code: 60. DB::Exception: …") em pt-PT, com o código. */
function clickhouseError(status: number, text: string, header: string | null) {
  const code = Number(header ?? /Code: (\d+)/.exec(text)?.[1] ?? 0);
  if (status === 401 || status === 403 || AUTH_CODES.has(code)) {
    return new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O ClickHouse recusou o utilizador ou a password (ou o utilizador não pode entrar deste endereço).',
    );
  }
  const message = text
    .replace(/\s+/g, ' ')
    .replace(/\(version [^)]*\)/, '')
    .trim()
    .slice(0, 500);
  const error = new Error(
    `o ClickHouse respondeu ${status}${code ? ` (código ${code})` : ''}: ${message}`,
  ) as Error & { clickhouseCode?: number };
  error.clickhouseCode = code;
  return error;
}

export function createClickhouseClient(
  baseUrl: string,
  user: string,
  password: string,
) {
  const root = normalizeClickhouseUrl(baseUrl);

  const send = async (
    sql: string,
    settings: Record<string, string | number>,
    timeoutMs: number,
  ): Promise<string> => {
    const params = new URLSearchParams(
      Object.entries(settings).map(([key, value]) => [key, String(value)]),
    );
    let response: Response;
    try {
      response = await fetch(`${root}/?${params.toString()}`, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': user,
          'X-ClickHouse-Key': password,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: sql,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o ClickHouse: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const text = await response.text();
    if (!response.ok) {
      throw clickhouseError(
        response.status,
        text,
        response.headers.get('X-ClickHouse-Exception-Code'),
      );
    }
    // Um erro a meio do resultado vem com 200 e o texto do erro no fim.
    if (/\bCode: \d+\. DB::Exception/.test(text.slice(-2000))) {
      throw clickhouseError(500, text.slice(-1000), null);
    }
    return text;
  };

  /** Uma leitura (SELECT/SHOW/DESCRIBE) em JSON, sem poder escrever e com as linhas limitadas. */
  const select = async <T = Record<string, unknown>>(
    sql: string,
    maxRows = 1000,
  ): Promise<ClickhouseResult<T>> => {
    const parse = (text: string) =>
      (text.trim()
        ? JSON.parse(text)
        : { meta: [], data: [], rows: 0 }) as ClickhouseResult<T>;
    const statement = sql.trim().replace(/;+\s*$/, '');
    try {
      // readonly=2: não escreve nem muda o esquema, mas deixa pôr as outras definições.
      return parse(
        await send(
          statement,
          {
            readonly: 2,
            default_format: 'JSON',
            max_result_rows: maxRows,
            result_overflow_mode: 'break',
            max_execution_time: 60,
          },
          75_000,
        ),
      );
    } catch (error) {
      // Um utilizador já só de leitura (readonly=1 no perfil) não pode mudar definições.
      if (
        (error as { clickhouseCode?: number }).clickhouseCode !== READONLY_CODE
      )
        throw error;
      const result = parse(
        await send(statement, { default_format: 'JSON' }, 75_000),
      );
      return { ...result, data: result.data.slice(0, maxRows) };
    }
  };

  return {
    root,
    select,
    /** Qualquer instrução (DDL, INSERT, ALTER, KILL…). Devolve o texto da resposta. */
    execute: (sql: string, timeoutMs = 300_000) =>
      send(
        sql.trim().replace(/;+\s*$/, ''),
        { default_format: 'JSON' },
        timeoutMs,
      ),
    /** Uma leitura que devolve só o texto (SHOW CREATE …, SHOW ACCESS). */
    raw: (sql: string) =>
      send(
        `${sql.trim().replace(/;+\s*$/, '')} FORMAT TSVRaw`,
        { readonly: 2 },
        60_000,
      ).catch((error: unknown) => {
        if (
          (error as { clickhouseCode?: number }).clickhouseCode !==
          READONLY_CODE
        )
          throw error;
        return send(
          `${sql.trim().replace(/;+\s*$/, '')} FORMAT TSVRaw`,
          {},
          60_000,
        );
      }),
    version: async () => {
      const result = await select<{ version: string }>(
        'SELECT version() AS version',
      );
      const version = result.data[0]?.version;
      if (!version) throw new Error('O ClickHouse não disse a versão.');
      return version;
    },
    whoami: async () => {
      const result = await select<{ user: string; version: string }>(
        'SELECT currentUser() AS user, version() AS version',
      );
      return result.data[0];
    },
  };
}

export type ClickhouseClient = ReturnType<typeof createClickhouseClient>;

/** A versão instalada, para as atualizações ("25.8.2.29"). */
export function clickhouseVersion(
  baseUrl: string,
  user: string,
  password: string,
) {
  return createClickhouseClient(baseUrl, user, password).version();
}

/**
 * A release estável mais recente do ClickHouse no GitHub. As tags são "v26.10.7.24-stable" e
 * "v25.8.11.66-lts", e saem correções de linhas antigas depois das novas: escolhe a versão mais
 * alta entre as stable/lts e não a última publicada.
 */
let cachedRelease: { at: number; release: AppRelease | null } | null = null;
export async function latestClickhouseRelease(): Promise<AppRelease | null> {
  if (cachedRelease && Date.now() - cachedRelease.at < 60 * 60_000)
    return cachedRelease.release;
  const response = await fetch(
    `https://api.github.com/repos/${CLICKHOUSE_REPOSITORY}/releases?per_page=30`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'MyHomeLab',
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`O GitHub respondeu ${response.status}`);
  const releases = (await response.json()) as {
    tag_name: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
  }[];
  const best = releases
    .filter(
      (item) =>
        !item.prerelease &&
        !item.draft &&
        /-(stable|lts)$/i.test(item.tag_name),
    )
    .map((item) => ({
      version: cleanVersion(item.tag_name).replace(/-(stable|lts)$/i, ''),
      url: item.html_url,
    }))
    .sort((a, b) => compareVersions(b.version, a.version))[0];
  cachedRelease = { at: Date.now(), release: best ?? null };
  return cachedRelease.release;
}
