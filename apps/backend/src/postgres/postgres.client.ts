import { Client, ClientConfig, QueryConfig, QueryResult } from 'pg';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { readOnlyStatementProblem } from './helpers/readOnlyStatement';

// O PostgreSQL ligado diretamente (pacote pg), sem API nem MCP no meio: o servidor tem de ser
// alcançável a partir do MyHomeLab no host e na porta (5432) — não serve o endereço de uma
// interface web como o pgAdmin ou o Adminer. Em baseUrl fica "postgres://host:porta/base
// ?sslmode=…" (nunca a password), o utilizador em username e a password cifrada em
// accessToken. Cada pedido abre uma ligação curta e fecha-a, com statement_timeout.
// Não tem aviso de versão nova (não está em VERSION_SOURCES): o PostgreSQL não publica
// releases no GitHub nem no Codeberg, de onde vêm as notas das atualizações.

export type PostgresSsl = 'off' | 'on' | 'no-verify';

export interface PostgresLocation {
  host: string;
  port: number;
  database: string;
  ssl: PostgresSsl;
}

const SSL_MODES: Record<PostgresSsl, string> = {
  off: 'disable',
  on: 'verify-full',
  'no-verify': 'require',
};

/** O endereço guardado (sem password): "postgres://host:5432/base?sslmode=require". */
export function postgresUrl(location: PostgresLocation): string {
  const host = location.host.includes(':')
    ? `[${location.host}]`
    : location.host;
  return `postgres://${host}:${location.port}/${encodeURIComponent(location.database)}?sslmode=${SSL_MODES[location.ssl]}`;
}

/** O contrário de postgresUrl. */
export function parsePostgresUrl(baseUrl: string): PostgresLocation {
  const url = new URL(baseUrl);
  const mode = url.searchParams.get('sslmode') ?? 'disable';
  const ssl = (Object.entries(SSL_MODES).find(
    ([, value]) => value === mode,
  )?.[0] ?? 'off') as PostgresSsl;
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port) || 5432,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    ssl,
  };
}

/** Tira o que se cola a mais no host: o esquema (https://, postgres://), o caminho e a porta. */
export function cleanPostgresHost(value: string): {
  host: string;
  port?: number;
} {
  const text = value.trim();
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `x://${text}`,
    );
    return {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port ? Number(url.port) : undefined,
    };
  } catch {
    return { host: text };
  }
}

export interface PostgresLogin {
  baseUrl: string;
  user: string;
  password: string;
}

/** Um identificador entre aspas, para meter no SQL sem injeção. */
export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** "1.2 GB" a partir de bytes. */
export function bytes(value: unknown): string {
  let size = Number(value ?? 0) || 0;
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

const AUTH_CODES = new Set(['28P01', '28000']);
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ECONNRESET',
  'EAI_AGAIN',
]);

/** O erro do pg em pt-PT: login errado, servidor inalcançável ou o erro do SQL com o código. */
export function postgresError(error: unknown): Error {
  if (error instanceof AppIntegrationError) return error;
  const { code, message } = error as { code?: string; message?: string };
  const text = message ?? String(error);
  if (code && AUTH_CODES.has(code)) {
    return new AppIntegrationError(
      'APP_AUTH_FAILED',
      `O PostgreSQL recusou o utilizador ou a password (${text}).`,
    );
  }
  if (
    (code && NETWORK_CODES.has(code)) ||
    /timeout expired|Connection terminated|self[- ]signed|certificate/i.test(
      text,
    )
  ) {
    return new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o PostgreSQL: ${text}. O host e a porta têm de ser os do próprio servidor PostgreSQL (não o pgAdmin/Adminer), alcançáveis a partir do MyHomeLab; vê também o SSL.`,
    );
  }
  if (code === '3D000') {
    return new Error(`essa base de dados não existe (${text})`);
  }
  if (code === '25006') {
    return new Error(
      `isto escreve e a consulta é só de leitura: usa postgres_execute (${text})`,
    );
  }
  if (code === '57014') {
    return new Error(`demorou demais e foi cancelada (${text})`);
  }
  return new Error(`o PostgreSQL respondeu${code ? ` ${code}` : ''}: ${text}`);
}

export function postgresConfig(
  login: PostgresLogin,
  options: { database?: string; statementTimeoutMs?: number } = {},
): ClientConfig {
  const location = parsePostgresUrl(login.baseUrl);
  return {
    host: location.host,
    port: location.port,
    database: options.database ?? location.database,
    user: login.user,
    password: login.password,
    ssl:
      location.ssl === 'off'
        ? false
        : { rejectUnauthorized: location.ssl === 'on' },
    application_name: 'MyHomeLab',
    connectionTimeoutMillis: 10_000,
    statement_timeout: options.statementTimeoutMs ?? 60_000,
    query_timeout: (options.statementTimeoutMs ?? 60_000) + 10_000,
  };
}

/** Abre uma ligação curta, faz o trabalho e fecha-a sempre. */
export async function withPostgres<T>(
  login: PostgresLogin,
  work: (client: Client) => Promise<T>,
  options: { database?: string; statementTimeoutMs?: number } = {},
): Promise<T> {
  const client = new Client(postgresConfig(login, options));
  client.on('error', () => undefined);
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => undefined);
    throw postgresError(error);
  }
  try {
    return await work(client);
  } catch (error) {
    throw postgresError(error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

const strip = (sql: string) => sql.trim().replace(/;+\s*$/, '');

/**
 * Uma consulta só de leitura: numa transação READ ONLY (que não pode passar a escrita), pelo
 * protocolo estendido (uma instrução só, sem "COMMIT; DROP …" escondido) e com as linhas
 * limitadas — um SELECT/WITH/VALUES/TABLE vai embrulhado num LIMIT, o resto corta-se cá.
 */
export async function readOnlyQuery(
  client: Client,
  sql: string,
  maxRows: number,
): Promise<{ result: QueryResult; truncated: boolean }> {
  const problem = readOnlyStatementProblem(sql);
  if (problem) throw new Error(problem);
  const statement = strip(sql);
  const wrap = /^\s*(select|with|values|table)\b/i.test(statement);
  await client.query('BEGIN READ ONLY');
  try {
    // Com o papel pg_read_all_data (PostgreSQL 14+) a consulta não tem os poderes de
    // superutilizador da ligação. Se a ligação não o puder usar, fica como estava.
    await client.query('SAVEPOINT leitura');
    await client
      .query('SET LOCAL ROLE pg_read_all_data')
      .catch(() => client.query('ROLLBACK TO SAVEPOINT leitura'));
    const result = await client.query({
      text: wrap
        ? `SELECT * FROM (\n${statement}\n) AS consulta LIMIT ${maxRows + 1}`
        : statement,
      queryMode: 'extended',
    } as QueryConfig);
    const truncated = result.rows.length > maxRows;
    result.rows = result.rows.slice(0, maxRows);
    return { result, truncated };
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
  }
}
