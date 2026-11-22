import { Client, QueryResult } from 'pg';
import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  bytes,
  parsePostgresUrl,
  PostgresLogin,
  readOnlyQuery,
  withPostgres,
} from 'src/postgres/postgres.client';
import { lisbonStamp } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O PostgreSQL (nome ou endereço). Omite quando só há um.',
};

const DATABASE = {
  type: 'string' as const,
  description:
    'A base de dados onde correr (omissão: a da ligação). O mesmo utilizador tem de poder entrar nela.',
};

const duration = (seconds: number) => {
  const value = Math.round(seconds);
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return days
    ? `${days} d ${hours} h`
    : hours
      ? `${hours} h ${minutes} min`
      : minutes
        ? `${minutes} min`
        : `${value} s`;
};

const cell = (value: unknown) => {
  const text =
    value === null || value === undefined
      ? 'NULL'
      : value instanceof Date
        ? value.toISOString()
        : Buffer.isBuffer(value)
          ? `\\x${value.toString('hex').slice(0, 40)}`
          : typeof value === 'string'
            ? value
            : typeof value === 'number' ||
                typeof value === 'bigint' ||
                typeof value === 'boolean'
              ? String(value)
              : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').slice(0, 120);
};

const when = (value: Date | string | null) => lisbonStamp(value, 'nunca');

/** O resultado como uma tabela de texto compacta (cabeçalho e linhas separadas por " | "). */
export function resultTable(result: QueryResult, truncated: boolean): string {
  if (!result.fields?.length) {
    return `Feito: ${result.command ?? ''}${result.rowCount !== null && result.rowCount !== undefined ? ` (${result.rowCount} linhas)` : ''}.`;
  }
  const names = result.fields.map((field) => field.name);
  if (!result.rows.length) return `Sem linhas (colunas: ${names.join(', ')}).`;
  return [
    `${result.rows.length} linhas${truncated ? ' (há mais: põe LIMIT, filtra ou agrega)' : ''}:`,
    names.join(' | '),
    ...result.rows.map((row: Record<string, unknown>) =>
      names.map((name) => cell(row[name])).join(' | '),
    ),
  ].join('\n');
}

/** "esquema.tabela" ou só "tabela" (no public). */
export function splitTable(name: string): [string, string] {
  const clean = name.trim().replace(/"/g, '');
  const dot = clean.indexOf('.');
  return dot > 0
    ? [clean.slice(0, dot), clean.slice(dot + 1)]
    : ['public', clean];
}

/** O PostgreSQL a usar: o único, ou o que bate com o nome ou o endereço. */
export async function postgresTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.POSTGRES,
    )
  ).filter(
    (account) =>
      account.isActive &&
      account.baseUrl &&
      account.username &&
      account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum PostgreSQL ligado. Liga-o em Apps ligadas → PostgreSQL.';
  }
  const label = (account: ConnectedAccount) => {
    const location = parsePostgresUrl(account.baseUrl ?? '');
    return `${account.displayName ?? 'PostgreSQL'} (${location.host}:${location.port}/${location.database})`;
  };
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o PostgreSQL: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

type Runner = <T>(
  work: (client: Client) => Promise<T>,
  options?: { database?: string; statementTimeoutMs?: number },
) => Promise<T>;

export function buildPostgresTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (postgres: Runner, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const account = await postgresTarget(context, input.account);
      if (typeof account === 'string') return account;
      const login: PostgresLogin = {
        baseUrl: account.baseUrl ?? '',
        user: account.username ?? '',
        password: account.accessToken ?? '',
      };
      const postgres: Runner = (task, options) =>
        withPostgres(login, task, options);
      try {
        return await work(postgres, input);
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  const inDatabase = (database?: string) =>
    database?.trim() ? { database: database.trim() } : {};

  return [
    {
      name: 'postgres_overview',
      description:
        'O PostgreSQL: a versão, há quanto tempo corre, as bases de dados com o tamanho, as ligações (por estado) e o limite, as consultas a correr há mais tempo, a replicação (primário/réplica, atraso) e a taxa de cache.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (postgres) =>
        postgres(async (client) => {
          const facts = (
            await client.query<{
              version: string;
              uptime: number;
              max: number;
              recovery: boolean;
              user: string;
            }>(
              `SELECT current_setting('server_version') AS version,
                 extract(epoch FROM now() - pg_postmaster_start_time())::int AS uptime,
                 current_setting('max_connections')::int AS max,
                 pg_is_in_recovery() AS recovery, current_user AS user`,
            )
          ).rows[0];
          const databases = await client.query<{
            name: string;
            size: string | null;
            connections: number;
            hit: string | null;
          }>(
            `SELECT d.datname AS name,
               CASE WHEN has_database_privilege(d.datname, 'CONNECT') THEN pg_database_size(d.datname) END AS size,
               s.numbackends AS connections,
               round(100.0 * s.blks_hit / nullif(s.blks_hit + s.blks_read, 0), 1)::text AS hit
             FROM pg_database d LEFT JOIN pg_stat_database s ON s.datid = d.oid
             WHERE NOT d.datistemplate ORDER BY 2 DESC NULLS LAST`,
          );
          const states = await client.query<{ state: string; count: number }>(
            `SELECT coalesce(state, backend_type) AS state, count(*)::int AS count
             FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC`,
          );
          const longest = await client.query<{
            pid: number;
            user: string | null;
            database: string | null;
            seconds: number;
            query: string;
          }>(
            `SELECT pid, usename AS user, datname AS database,
               extract(epoch FROM now() - query_start)::int AS seconds, query
             FROM pg_stat_activity
             WHERE state = 'active' AND pid <> pg_backend_pid() AND backend_type = 'client backend'
             ORDER BY query_start LIMIT 5`,
          );
          const replication = facts.recovery
            ? await client
                .query<{ lag: number | null; sender: string | null }>(
                  `SELECT extract(epoch FROM now() - pg_last_xact_replay_timestamp())::int AS lag,
                     (SELECT sender_host FROM pg_stat_wal_receiver LIMIT 1) AS sender`,
                )
                .then(
                  ({ rows }) =>
                    `É uma réplica${rows[0]?.sender ? ` de ${rows[0].sender}` : ''}; atraso ${rows[0]?.lag ?? '?'} s.`,
                )
                .catch(() => 'É uma réplica.')
            : await client
                .query<{
                  client: string | null;
                  state: string;
                  lag: string | null;
                }>(
                  `SELECT coalesce(application_name, client_addr::text) AS client, state,
                     pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS lag
                   FROM pg_stat_replication`,
                )
                .then(({ rows }) =>
                  rows.length
                    ? `Réplicas: ${rows.map((row) => `${row.client ?? '?'} (${row.state}, ${row.lag ?? '?'} atrás)`).join(', ')}.`
                    : 'Sem réplicas.',
                )
                .catch(() => '');
          const total = states.rows.reduce((sum, row) => sum + row.count, 0);
          return [
            `PostgreSQL ${facts.version} — utilizador ${facts.user}, a correr há ${duration(facts.uptime)}.`,
            `Ligações: ${total} de ${facts.max} (${states.rows.map((row) => `${row.count} ${row.state}`).join(', ')}).`,
            `Bases de dados (${databases.rows.length}):`,
            ...databases.rows.map(
              (row) =>
                `- ${row.name} — ${row.size === null ? 'sem acesso' : bytes(row.size)}, ${row.connections ?? 0} ligações${row.hit ? `, cache ${row.hit}%` : ''}`,
            ),
            longest.rows.length
              ? `A correr há mais tempo:\n${longest.rows.map((row) => `- pid ${row.pid} ${row.user ?? ''}@${row.database ?? ''} há ${duration(row.seconds)}: ${cell(row.query).slice(0, 160)}`).join('\n')}`
              : 'Nenhuma consulta a correr.',
            replication,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ),
    },
    {
      name: 'postgres_tables',
      description:
        'Os esquemas e as tabelas (e vistas materializadas) de uma base do PostgreSQL com as linhas estimadas, o tamanho (com índices), as linhas mortas e o último vacuum/analyze. Filtra por esquema ou texto no nome.',
      inputSchema: {
        type: 'object',
        properties: {
          database: DATABASE,
          schema: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'integer', description: 'Até 300 (omissão 100).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          postgres,
          input: {
            database?: string;
            schema?: string;
            search?: string;
            limit?: number;
          },
        ) =>
          postgres(async (client) => {
            const limit = Math.min(input.limit ?? 100, 300);
            const schemas = await client.query<{
              name: string;
              tables: number;
            }>(
              `SELECT n.nspname AS name, count(c.oid)::int AS tables
               FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r', 'p', 'm')
               WHERE n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
               GROUP BY 1 ORDER BY 1`,
            );
            const tables = await client.query<{
              schema: string;
              name: string;
              kind: string;
              rows: string;
              size: string;
              dead: string | null;
              vacuum: Date | null;
              analyze: Date | null;
            }>(
              `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
                 greatest(c.reltuples, 0)::bigint AS rows, pg_total_relation_size(c.oid) AS size,
                 s.n_dead_tup AS dead,
                 greatest(s.last_vacuum, s.last_autovacuum) AS vacuum,
                 greatest(s.last_analyze, s.last_autoanalyze) AS analyze
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
               WHERE c.relkind IN ('r', 'p', 'm')
                 AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
                 AND ($1::text IS NULL OR n.nspname = $1)
                 AND ($2::text IS NULL OR c.relname ILIKE '%' || $2 || '%')
               ORDER BY pg_total_relation_size(c.oid) DESC LIMIT $3`,
              [
                input.schema?.trim() || null,
                input.search?.trim() || null,
                limit + 1,
              ],
            );
            return [
              `Esquemas: ${schemas.rows.map((row) => `${row.name} (${row.tables})`).join(', ') || 'nenhum'}.`,
              tables.rows.length
                ? `${Math.min(tables.rows.length, limit)} tabelas${tables.rows.length > limit ? ' (há mais)' : ''}:`
                : 'Nenhuma tabela.',
              ...tables.rows
                .slice(0, limit)
                .map(
                  (row) =>
                    `- ${row.schema}.${row.name}${row.kind === 'm' ? ' (vista materializada)' : row.kind === 'p' ? ' (particionada)' : ''} — ~${Number(row.rows).toLocaleString('pt-PT')} linhas, ${bytes(row.size)}${Number(row.dead) ? `, ${Number(row.dead).toLocaleString('pt-PT')} mortas` : ''}, vacuum ${when(row.vacuum)}, analyze ${when(row.analyze)}`,
                ),
            ].join('\n');
          }, inDatabase(input.database)),
      ),
    },
    {
      name: 'postgres_describe',
      description:
        'Uma tabela do PostgreSQL ("esquema.tabela"): as colunas (tipo, nulo, omissão, comentário), os índices (com o tamanho e quantas vezes foram usados), as restrições (chave primária, estrangeiras, únicas, check), os triggers, o tamanho e as linhas estimadas.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: '"esquema.tabela"' },
          database: DATABASE,
          account: ACCOUNT,
        },
        required: ['table'],
      },
      handler: run(
        async (postgres, input: { table: string; database?: string }) =>
          postgres(async (client) => {
            const [schema, table] = splitTable(input.table);
            const info = await client.query<{
              oid: number;
              rows: string;
              size: string;
              table_size: string;
              comment: string | null;
            }>(
              `SELECT c.oid, greatest(c.reltuples, 0)::bigint AS rows,
                 pg_total_relation_size(c.oid) AS size, pg_relation_size(c.oid) AS table_size,
                 obj_description(c.oid, 'pg_class') AS comment
               FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = $1 AND c.relname = $2`,
              [schema, table],
            );
            const meta = info.rows[0];
            if (!meta) return `Não há a tabela ${schema}.${table}.`;
            const [columns, indexes, constraints, triggers] = await Promise.all(
              [
                client.query<{
                  name: string;
                  type: string;
                  notnull: boolean;
                  default: string | null;
                  comment: string | null;
                }>(
                  `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
                   pg_get_expr(d.adbin, d.adrelid) AS default, col_description(a.attrelid, a.attnum) AS comment
                 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                 WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`,
                  [meta.oid],
                ),
                client.query<{
                  name: string;
                  definition: string;
                  size: string;
                  scans: string | null;
                }>(
                  `SELECT i.relname AS name, pg_get_indexdef(x.indexrelid) AS definition,
                   pg_relation_size(x.indexrelid) AS size, s.idx_scan AS scans
                 FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
                 LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = x.indexrelid
                 WHERE x.indrelid = $1 ORDER BY i.relname`,
                  [meta.oid],
                ),
                client.query<{ name: string; definition: string }>(
                  `SELECT conname AS name, pg_get_constraintdef(oid) AS definition
                 FROM pg_constraint WHERE conrelid = $1 ORDER BY contype, conname`,
                  [meta.oid],
                ),
                client.query<{ name: string; definition: string }>(
                  `SELECT tgname AS name, pg_get_triggerdef(oid) AS definition
                 FROM pg_trigger WHERE tgrelid = $1 AND NOT tgisinternal ORDER BY tgname`,
                  [meta.oid],
                ),
              ],
            );
            return [
              `${schema}.${table} — ~${Number(meta.rows).toLocaleString('pt-PT')} linhas, ${bytes(meta.size)} (dados ${bytes(meta.table_size)}).`,
              meta.comment ? `Comentário: ${meta.comment}` : '',
              `Colunas (${columns.rows.length}):`,
              ...columns.rows.map(
                (col) =>
                  `- ${col.name} ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.default ? ` DEFAULT ${col.default}` : ''}${col.comment ? ` — ${col.comment}` : ''}`,
              ),
              indexes.rows.length
                ? `Índices:\n${indexes.rows.map((row) => `- ${row.definition} — ${bytes(row.size)}${row.scans !== null ? `, usado ${row.scans}×` : ''}`).join('\n')}`
                : 'Sem índices.',
              constraints.rows.length
                ? `Restrições:\n${constraints.rows.map((row) => `- ${row.name}: ${row.definition}`).join('\n')}`
                : '',
              triggers.rows.length
                ? `Triggers:\n${triggers.rows.map((row) => `- ${row.definition}`).join('\n')}`
                : '',
            ]
              .filter(Boolean)
              .join('\n');
          }, inDatabase(input.database)),
      ),
    },
    {
      name: 'postgres_query',
      description:
        'Corre uma consulta de leitura no PostgreSQL (SELECT, WITH, EXPLAIN, SHOW…) e devolve as linhas numa tabela compacta. Vai numa transação READ ONLY (não consegue escrever, e com o papel pg_read_all_data quando a ligação o permite), uma instrução só, até 60 s e com as linhas limitadas. COPY, EXPLAIN ANALYZE e funções que mexem no servidor (pg_terminate_backend, dblink, pg_read_file…) são recusadas. Para escrever usa postgres_execute.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          database: DATABASE,
          limit: {
            type: 'integer',
            description: 'Linhas a mostrar, até 500 (omissão 100).',
          },
          account: ACCOUNT,
        },
        required: ['sql'],
      },
      handler: run(
        async (
          postgres,
          input: { sql: string; database?: string; limit?: number },
        ) =>
          postgres(async (client) => {
            const shown = Math.min(Math.max(input.limit ?? 100, 1), 500);
            const { result, truncated } = await readOnlyQuery(
              client,
              input.sql,
              shown,
            );
            return resultTable(result, truncated);
          }, inDatabase(input.database)),
      ),
    },
    {
      name: 'postgres_execute',
      description:
        'Corre qualquer SQL no PostgreSQL: CREATE/ALTER/DROP, INSERT/UPDATE/DELETE, GRANT, CREATE ROLE/DATABASE, VACUUM, REINDEX… (pode ser um script com várias instruções; até 10 min). Faz só quando ele pedir. As que apagam ou mudam dados (DROP, TRUNCATE, DELETE, UPDATE sem WHERE, ALTER … DROP): confirma com ele antes, dizendo o que vai desaparecer. Para ler usa postgres_query.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          database: DATABASE,
          account: ACCOUNT,
        },
        required: ['sql'],
      },
      handler: run(
        async (postgres, input: { sql: string; database?: string }) =>
          postgres(
            async (client) => {
              const result = (await client.query(input.sql)) as
                QueryResult | QueryResult[];
              const results = Array.isArray(result) ? result : [result];
              const last = results[results.length - 1];
              if (last.rows.length > 100) last.rows = last.rows.slice(0, 100);
              return [
                results.length > 1
                  ? `Corri ${results.length} instruções: ${results.map((item) => `${item.command}${item.rowCount !== null ? ` ${item.rowCount}` : ''}`).join(', ')}.`
                  : '',
                resultTable(last, false),
              ]
                .filter(Boolean)
                .join('\n');
            },
            { ...inDatabase(input.database), statementTimeoutMs: 600_000 },
          ),
      ),
    },
    {
      name: 'postgres_activity',
      description:
        'O que está ligado ao PostgreSQL agora (pg_stat_activity): pid, utilizador, base, app, estado, há quanto tempo, à espera de quê e o SQL; e os bloqueios (quem está bloqueado por quem). Filtra por estado ou base.',
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            enum: ['active', 'idle', 'idle in transaction', 'all'],
            description: 'Omissão: tudo menos idle.',
          },
          database: {
            type: 'string',
            description: 'Só as ligações a esta base.',
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (postgres, input: { state?: string; database?: string }) =>
          postgres(async (client) => {
            const state = input.state ?? 'busy';
            const sessions = await client.query<{
              pid: number;
              user: string | null;
              database: string | null;
              app: string | null;
              client: string | null;
              state: string | null;
              seconds: number | null;
              wait: string | null;
              query: string;
            }>(
              `SELECT pid, usename AS user, datname AS database, application_name AS app,
                 client_addr::text AS client, state,
                 extract(epoch FROM now() - coalesce(query_start, backend_start))::int AS seconds,
                 nullif(concat_ws(':', wait_event_type, wait_event), '') AS wait, query
               FROM pg_stat_activity
               WHERE pid <> pg_backend_pid() AND backend_type = 'client backend'
                 AND ($1 = 'all' OR ($1 = 'busy' AND state IS DISTINCT FROM 'idle') OR state = $1)
                 AND ($2::text IS NULL OR datname = $2)
               ORDER BY query_start NULLS LAST LIMIT 60`,
              [state, input.database?.trim() || null],
            );
            const locks = await client.query<{
              pid: number;
              blocked_by: number[];
              seconds: number;
              query: string;
            }>(
              `SELECT pid, pg_blocking_pids(pid) AS blocked_by,
                 extract(epoch FROM now() - query_start)::int AS seconds, query
               FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0`,
            );
            return [
              sessions.rows.length
                ? `Ligações (${sessions.rows.length}):\n${sessions.rows
                    .map(
                      (row) =>
                        `- pid ${row.pid} ${row.user ?? ''}@${row.database ?? ''}${row.app ? ` [${row.app}]` : ''}${row.client ? ` de ${row.client}` : ''} — ${row.state ?? '?'} há ${duration(row.seconds ?? 0)}${row.wait ? `, à espera de ${row.wait}` : ''}: ${cell(row.query).slice(0, 160)}`,
                    )
                    .join('\n')}`
                : 'Nenhuma ligação nesse estado.',
              locks.rows.length
                ? `Bloqueados:\n${locks.rows.map((row) => `- pid ${row.pid} à espera de ${row.blocked_by.join(', ')} há ${duration(row.seconds)}: ${cell(row.query).slice(0, 160)}`).join('\n')}`
                : 'Sem bloqueios.',
            ].join('\n');
          }),
      ),
    },
    {
      name: 'postgres_cancel',
      description:
        'Para uma ligação do PostgreSQL pelo pid (de postgres_activity): cancela só a consulta (pg_cancel_backend) ou, com terminate, fecha a ligação inteira (pg_terminate_backend, desfaz a transação aberta). Faz só quando ele pedir; para terminate confirma com ele antes.',
      inputSchema: {
        type: 'object',
        properties: {
          pid: { type: 'integer' },
          terminate: { type: 'boolean' },
          account: ACCOUNT,
        },
        required: ['pid'],
      },
      handler: run(
        async (postgres, input: { pid: number; terminate?: boolean }) =>
          postgres(async (client) => {
            const { rows } = await client.query<{ done: boolean }>(
              input.terminate
                ? 'SELECT pg_terminate_backend($1) AS done'
                : 'SELECT pg_cancel_backend($1) AS done',
              [input.pid],
            );
            return rows[0]?.done
              ? `${input.terminate ? 'Fechei a ligação' : 'Cancelei a consulta do'} pid ${input.pid}.`
              : `O pid ${input.pid} já não existe (ou este utilizador não o pode parar: precisa de ser superuser ou ter pg_signal_backend).`;
          }),
      ),
    },
    {
      name: 'postgres_maintenance',
      description:
        'A manutenção do PostgreSQL numa base: as tabelas com mais linhas mortas e quando levaram vacuum/analyze, os vacuums a correr agora, a idade das transações por base (risco de wraparound), os índices nunca usados e as transações abertas há muito.',
      inputSchema: {
        type: 'object',
        properties: { database: DATABASE, account: ACCOUNT },
      },
      handler: run(async (postgres, input: { database?: string }) =>
        postgres(async (client) => {
          const [dead, vacuums, ages, unused, idle] = await Promise.all([
            client.query<{
              name: string;
              live: string;
              dead: string;
              vacuum: Date | null;
              analyze: Date | null;
              mods: string;
            }>(
              `SELECT schemaname || '.' || relname AS name, n_live_tup AS live, n_dead_tup AS dead,
                 greatest(last_vacuum, last_autovacuum) AS vacuum,
                 greatest(last_analyze, last_autoanalyze) AS analyze, n_mod_since_analyze AS mods
               FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10`,
            ),
            client
              .query<{ pid: number; name: string; phase: string }>(
                `SELECT p.pid, p.relid::regclass::text AS name, p.phase FROM pg_stat_progress_vacuum p`,
              )
              .catch(() => ({
                rows: [] as { pid: number; name: string; phase: string }[],
              })),
            client.query<{ name: string; age: number; max: number }>(
              `SELECT datname AS name, age(datfrozenxid) AS age,
                 current_setting('autovacuum_freeze_max_age')::int AS max
               FROM pg_database WHERE datallowconn ORDER BY 2 DESC`,
            ),
            client.query<{ name: string; table: string; size: string }>(
              `SELECT s.schemaname || '.' || s.indexrelname AS name, s.relname AS table,
                 pg_relation_size(s.indexrelid) AS size
               FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
               WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
               ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 10`,
            ),
            client.query<{ pid: number; user: string | null; seconds: number }>(
              `SELECT pid, usename AS user, extract(epoch FROM now() - xact_start)::int AS seconds
               FROM pg_stat_activity
               WHERE state = 'idle in transaction' AND xact_start < now() - interval '5 minutes'
               ORDER BY xact_start`,
            ),
          ]);
          return [
            dead.rows.length
              ? `Linhas mortas (as 10 piores):\n${dead.rows.map((row) => `- ${row.name} — ${Number(row.dead).toLocaleString('pt-PT')} mortas / ${Number(row.live).toLocaleString('pt-PT')} vivas, vacuum ${when(row.vacuum)}, analyze ${when(row.analyze)} (${Number(row.mods).toLocaleString('pt-PT')} mudanças desde)`).join('\n')}`
              : 'Sem tabelas nesta base.',
            vacuums.rows.length
              ? `Vacuum a correr: ${vacuums.rows.map((row) => `${row.name} (pid ${row.pid}, ${row.phase})`).join(', ')}.`
              : 'Nenhum vacuum a correr.',
            `Idade das transações (wraparound): ${ages.rows.map((row) => `${row.name} ${Math.round((100 * row.age) / row.max)}%`).join(', ')} do limite do autovacuum.`,
            unused.rows.length
              ? `Índices nunca usados (desde o último reset das estatísticas):\n${unused.rows.map((row) => `- ${row.name} em ${row.table} — ${bytes(row.size)}`).join('\n')}`
              : 'Todos os índices foram usados.',
            idle.rows.length
              ? `Transações abertas paradas há mais de 5 min: ${idle.rows.map((row) => `pid ${row.pid} ${row.user ?? ''} há ${duration(row.seconds)}`).join(', ')}.`
              : '',
          ]
            .filter(Boolean)
            .join('\n');
        }, inDatabase(input.database)),
      ),
    },
  ];
}
