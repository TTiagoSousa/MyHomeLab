import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  bytes,
  ClickhouseClient,
  ClickhouseResult,
  createClickhouseClient,
  num,
  quoteText,
} from 'src/clickhouse/clickhouse.client';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O ClickHouse (nome ou endereço). Omite quando só há um.',
};

const SYSTEM_DATABASES =
  "('system', 'INFORMATION_SCHEMA', 'information_schema')";

const duration = (seconds: number) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days
    ? `${days} d ${hours} h`
    : hours
      ? `${hours} h ${minutes} min`
      : `${minutes} min`;
};

const cell = (value: unknown) => {
  const text =
    value === null || value === undefined
      ? 'NULL'
      : typeof value === 'string'
        ? value
        : typeof value === 'number' ||
            typeof value === 'bigint' ||
            typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').slice(0, 120);
};

/** O resultado como uma tabela de texto compacta (cabeçalho e linhas separadas por " | "). */
export function resultTable(result: ClickhouseResult, shown: number): string {
  if (!result.meta.length) return 'Feito (sem resultado).';
  if (!result.data.length)
    return `Sem linhas (colunas: ${result.meta.map((col) => col.name).join(', ')}).`;
  const names = result.meta.map((col) => col.name);
  const lines = result.data
    .slice(0, shown)
    .map((row) => names.map((name) => cell(row[name])).join(' | '));
  const more =
    result.rows_before_limit_at_least &&
    result.rows_before_limit_at_least > shown
      ? ` de pelo menos ${result.rows_before_limit_at_least}`
      : result.data.length > shown
        ? ` de ${result.data.length}+`
        : '';
  return [
    `${Math.min(result.data.length, shown)} linhas${more}${result.statistics ? ` (${result.statistics.elapsed.toFixed(2)} s, ${num(result.statistics.rows_read)} linhas lidas)` : ''}:`,
    names.join(' | '),
    ...lines,
  ].join('\n');
}

/** "base.tabela" ou só "tabela" (na base default). */
export function splitTable(name: string): [string, string] {
  const clean = name.trim().replace(/`/g, '');
  const dot = clean.indexOf('.');
  return dot > 0
    ? [clean.slice(0, dot), clean.slice(dot + 1)]
    : ['default', clean];
}

/** O ClickHouse a usar: o único, ou o que bate com o nome ou o endereço. */
export async function clickhouseTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.CLICKHOUSE,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.username,
  );
  if (!accounts.length) {
    return 'Não há nenhum ClickHouse ligado. Liga-o em Apps ligadas → ClickHouse.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'ClickHouse'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o ClickHouse: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

export function buildClickHouseTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (clickhouse: ClickhouseClient, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const account = await clickhouseTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createClickhouseClient(
            account.baseUrl ?? '',
            account.username ?? '',
            account.accessToken ?? '',
          ),
          input,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'clickhouse_overview',
      description:
        'O ClickHouse: a versão, o utilizador, há quanto tempo corre, as bases de dados com o tamanho e as linhas, quantas tabelas, as consultas a correr, os merges e o espaço em disco.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (clickhouse) => {
        const [me, uptime, databases, disks, processes, merges] =
          await Promise.all([
            clickhouse.whoami(),
            clickhouse.select<{ uptime: string }>('SELECT uptime() AS uptime'),
            clickhouse.select<{
              name: string;
              engine: string;
              tables: string;
              rows: string;
              bytes: string;
            }>(
              `SELECT d.name AS name, d.engine AS engine,
                 (SELECT count() FROM system.tables t WHERE t.database = d.name) AS tables,
                 ifNull(p.rows, 0) AS rows, ifNull(p.bytes, 0) AS bytes
               FROM system.databases d
               LEFT JOIN (SELECT database, sum(rows) AS rows, sum(bytes_on_disk) AS bytes FROM system.parts WHERE active GROUP BY database) p ON p.database = d.name
               WHERE d.name NOT IN ${SYSTEM_DATABASES}
               ORDER BY bytes DESC`,
            ),
            clickhouse
              .select<{
                name: string;
                path: string;
                free: string;
                total: string;
              }>(
                'SELECT name, path, free_space AS free, total_space AS total FROM system.disks',
              )
              .catch(() => null),
            clickhouse
              .select<{ count: string; longest: string }>(
                'SELECT count() AS count, max(elapsed) AS longest FROM system.processes',
              )
              .catch(() => null),
            clickhouse
              .select<{ count: string }>(
                'SELECT count() AS count FROM system.merges',
              )
              .catch(() => null),
          ]);
        const running = processes?.data[0];
        return [
          `ClickHouse ${me.version} — utilizador ${me.user}, a correr há ${duration(num(uptime.data[0]?.uptime))}.`,
          `Bases de dados (${databases.data.length}):`,
          ...databases.data.map(
            (db) =>
              `- ${db.name} (${db.engine}) — ${num(db.tables)} tabelas, ${num(db.rows).toLocaleString('pt-PT')} linhas, ${bytes(db.bytes)}`,
          ),
          running
            ? `Consultas a correr: ${num(running.count)}${num(running.count) ? ` (a mais longa há ${Math.round(num(running.longest))} s)` : ''}.`
            : '',
          merges ? `Merges a correr: ${num(merges.data[0]?.count)}.` : '',
          disks?.data.length
            ? `Disco: ${disks.data.map((disk) => `${disk.name} ${bytes(disk.free)} livres de ${bytes(disk.total)}`).join('; ')}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'clickhouse_tables',
      description:
        'As tabelas de uma base de dados do ClickHouse (ou de todas, sem database) com o motor, as linhas, o tamanho em disco e a compressão. Filtra por texto no nome.',
      inputSchema: {
        type: 'object',
        properties: {
          database: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'integer', description: 'Até 300 (omissão 100).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          clickhouse,
          input: { database?: string; search?: string; limit?: number },
        ) => {
          const where = [
            input.database?.trim()
              ? `t.database = ${quoteText(input.database.trim())}`
              : `t.database NOT IN ${SYSTEM_DATABASES}`,
            input.search?.trim()
              ? `positionCaseInsensitive(t.name, ${quoteText(input.search.trim())}) > 0`
              : '',
          ]
            .filter(Boolean)
            .join(' AND ');
          const limit = Math.min(input.limit ?? 100, 300);
          const result = await clickhouse.select<{
            database: string;
            name: string;
            engine: string;
            rows: string | null;
            bytes: string | null;
            raw: string | null;
          }>(
            `SELECT t.database AS database, t.name AS name, t.engine AS engine,
               t.total_rows AS rows, t.total_bytes AS bytes, p.raw AS raw
             FROM system.tables t
             LEFT JOIN (SELECT database, table, sum(data_uncompressed_bytes) AS raw FROM system.parts WHERE active GROUP BY database, table) p
               ON p.database = t.database AND p.table = t.name
             WHERE ${where}
             ORDER BY t.total_bytes DESC NULLS LAST, t.name
             LIMIT ${limit + 1}`,
          );
          if (!result.data.length) return 'Nenhuma tabela.';
          return [
            `${Math.min(result.data.length, limit)} tabelas${result.data.length > limit ? ' (há mais)' : ''}:`,
            ...result.data.slice(0, limit).map((row) => {
              const ratio =
                num(row.raw) && num(row.bytes)
                  ? `, compressão ${(num(row.raw) / num(row.bytes)).toFixed(1)}×`
                  : '';
              return `- ${row.database}.${row.name} — ${row.engine}${row.rows !== null ? `, ${num(row.rows).toLocaleString('pt-PT')} linhas` : ''}${row.bytes !== null ? `, ${bytes(row.bytes)}` : ''}${ratio}`;
            }),
          ].join('\n');
        },
      ),
    },
    {
      name: 'clickhouse_describe',
      description:
        'Uma tabela do ClickHouse ("base.tabela"): as colunas (tipo, omissão, comentário, tamanho), o motor, a chave de ordenação, a partição, a chave primária, o TTL, as linhas, o tamanho, as partes e o CREATE completo.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: '"base.tabela"' },
          account: ACCOUNT,
        },
        required: ['table'],
      },
      handler: run(async (clickhouse, input: { table: string }) => {
        const [database, table] = splitTable(input.table);
        const filter = `database = ${quoteText(database)} AND table = ${quoteText(table)}`;
        const [info, columns, parts] = await Promise.all([
          clickhouse.select<{
            engine: string;
            sorting_key: string;
            partition_key: string;
            primary_key: string;
            total_rows: string | null;
            total_bytes: string | null;
            create_table_query: string;
            comment: string;
          }>(
            `SELECT engine, sorting_key, partition_key, primary_key, total_rows, total_bytes, create_table_query, comment
             FROM system.tables WHERE database = ${quoteText(database)} AND name = ${quoteText(table)}`,
          ),
          clickhouse.select<{
            name: string;
            type: string;
            default_kind: string;
            default_expression: string;
            comment: string;
            compressed: string;
          }>(
            `SELECT name, type, default_kind, default_expression, comment, data_compressed_bytes AS compressed
             FROM system.columns WHERE ${filter} ORDER BY position`,
          ),
          clickhouse
            .select<{ parts: string; partitions: string }>(
              `SELECT count() AS parts, uniqExact(partition) AS partitions FROM system.parts WHERE active AND ${filter}`,
            )
            .catch(() => null),
        ]);
        const meta = info.data[0];
        if (!meta) return `Não há a tabela ${database}.${table}.`;
        return [
          `${database}.${table} — ${meta.engine}${meta.total_rows !== null ? `, ${num(meta.total_rows).toLocaleString('pt-PT')} linhas` : ''}${meta.total_bytes !== null ? `, ${bytes(meta.total_bytes)}` : ''}${parts?.data[0] ? `, ${num(parts.data[0].parts)} partes em ${num(parts.data[0].partitions)} partições` : ''}.`,
          meta.comment ? `Comentário: ${meta.comment}` : '',
          meta.sorting_key ? `ORDER BY ${meta.sorting_key}` : '',
          meta.primary_key && meta.primary_key !== meta.sorting_key
            ? `PRIMARY KEY ${meta.primary_key}`
            : '',
          meta.partition_key ? `PARTITION BY ${meta.partition_key}` : '',
          `Colunas (${columns.data.length}):`,
          ...columns.data.map(
            (col) =>
              `- ${col.name} ${col.type}${col.default_kind ? ` ${col.default_kind} ${col.default_expression}` : ''}${num(col.compressed) ? ` — ${bytes(col.compressed)}` : ''}${col.comment ? ` — ${col.comment}` : ''}`,
          ),
          `CREATE:\n${meta.create_table_query.slice(0, 4000)}`,
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'clickhouse_query',
      description:
        'Corre uma consulta de leitura no ClickHouse (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH …) e devolve as linhas numa tabela compacta. Vai com readonly (não consegue escrever nem mudar o esquema), até 60 s e com as linhas limitadas — põe LIMIT/agrega em tabelas grandes. Para escrever usa clickhouse_execute.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          limit: {
            type: 'integer',
            description: 'Linhas a mostrar, até 500 (omissão 100).',
          },
          account: ACCOUNT,
        },
        required: ['sql'],
      },
      handler: run(
        async (clickhouse, input: { sql: string; limit?: number }) => {
          const shown = Math.min(Math.max(input.limit ?? 100, 1), 500);
          return resultTable(await clickhouse.select(input.sql, shown), shown);
        },
      ),
    },
    {
      name: 'clickhouse_execute',
      description:
        'Corre qualquer instrução no ClickHouse: CREATE/ALTER/DROP/TRUNCATE, INSERT, OPTIMIZE, SYSTEM, GRANT, CREATE USER… Faz só quando ele pedir. As que apagam ou mudam dados (DROP, TRUNCATE, DELETE, ALTER … DELETE/UPDATE, DETACH): confirma com ele antes, dizendo o que vai desaparecer. Para ler usa clickhouse_query.',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'Uma instrução só.' },
          account: ACCOUNT,
        },
        required: ['sql'],
      },
      handler: run(async (clickhouse, input: { sql: string }) => {
        const text = (await clickhouse.execute(input.sql)).trim();
        if (!text) return 'Feito.';
        try {
          return resultTable(JSON.parse(text) as ClickhouseResult, 100);
        } catch {
          return `Feito: ${text.slice(0, 2000)}`;
        }
      }),
    },
    {
      name: 'clickhouse_queries',
      description:
        'As consultas a correr agora no ClickHouse (id, utilizador, há quanto tempo, memória, linhas lidas, o SQL) e, com recent, as que falharam ou foram mais lentas na última hora (do query_log).',
      inputSchema: {
        type: 'object',
        properties: {
          recent: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(async (clickhouse, input: { recent?: boolean }) => {
        const running = await clickhouse.select<{
          query_id: string;
          user: string;
          elapsed: number;
          memory: string;
          read_rows: string;
          query: string;
        }>(
          `SELECT query_id, user, elapsed, memory_usage AS memory, read_rows, query
           FROM system.processes WHERE query_id != queryID() ORDER BY elapsed DESC LIMIT 50`,
        );
        const lines = running.data.length
          ? [
              `A correr (${running.data.length}):`,
              ...running.data.map(
                (row) =>
                  `- ${row.query_id} — ${row.user}, ${Math.round(num(row.elapsed))} s, ${bytes(row.memory)}, ${num(row.read_rows).toLocaleString('pt-PT')} linhas lidas: ${cell(row.query).slice(0, 200)}`,
              ),
            ]
          : ['Nenhuma consulta a correr.'];
        if (input.recent) {
          const log = await clickhouse
            .select<{
              time: string;
              user: string;
              ms: string;
              type: string;
              exception: string;
              query: string;
            }>(
              `SELECT event_time AS time, user, query_duration_ms AS ms, type, exception, query
               FROM system.query_log
               WHERE event_time > now() - INTERVAL 1 HOUR AND type != 'QueryStart'
                 AND (type != 'QueryFinish' OR query_duration_ms > 1000)
               ORDER BY type = 'QueryFinish', query_duration_ms DESC LIMIT 30`,
            )
            .catch(() => null);
          lines.push(
            !log
              ? 'O query_log não está ligado (ou este utilizador não o pode ler).'
              : log.data.length
                ? [
                    'Última hora (falhas e lentas):',
                    ...log.data.map(
                      (row) =>
                        `- ${row.time} ${row.user} ${row.type === 'QueryFinish' ? `${num(row.ms)} ms` : `FALHOU: ${cell(row.exception).slice(0, 200)}`} — ${cell(row.query).slice(0, 160)}`,
                    ),
                  ].join('\n')
                : 'Na última hora nada falhou nem demorou mais de 1 s.',
          );
        }
        return lines.join('\n');
      }),
    },
    {
      name: 'clickhouse_kill',
      description:
        'Para uma consulta a correr no ClickHouse (KILL QUERY pelo id de clickhouse_queries) ou uma mutação presa (mutation, pelo id e a tabela). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          queryId: { type: 'string' },
          mutationId: { type: 'string' },
          table: {
            type: 'string',
            description: '"base.tabela" (só para a mutação).',
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          clickhouse,
          input: { queryId?: string; mutationId?: string; table?: string },
        ) => {
          if (input.mutationId?.trim()) {
            if (!input.table?.trim()) return 'Diz a tabela da mutação.';
            const [database, table] = splitTable(input.table);
            await clickhouse.execute(
              `KILL MUTATION WHERE database = ${quoteText(database)} AND table = ${quoteText(table)} AND mutation_id = ${quoteText(input.mutationId.trim())}`,
            );
            return `Pedi para parar a mutação ${input.mutationId} em ${database}.${table}.`;
          }
          if (!input.queryId?.trim()) return 'Diz o id da consulta.';
          await clickhouse.execute(
            `KILL QUERY WHERE query_id = ${quoteText(input.queryId.trim())} ASYNC`,
          );
          return `Pedi para parar a consulta ${input.queryId} (vê com clickhouse_queries se já saiu).`;
        },
      ),
    },
    {
      name: 'clickhouse_health',
      description:
        'A saúde do ClickHouse: a memória, as ligações, as partes por tabela (muitas = inserts pequenos demais), as mutações por acabar, a fila de replicação, as tabelas só de leitura e os erros desde o arranque (system.errors).',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (clickhouse) => {
        const quiet = <T>(promise: Promise<ClickhouseResult<T>>) =>
          promise.catch(() => null);
        const [metrics, memory, parts, mutations, replicas, errors] =
          await Promise.all([
            quiet(
              clickhouse.select<{ metric: string; value: string }>(
                "SELECT metric, value FROM system.metrics WHERE metric IN ('Query', 'TCPConnection', 'HTTPConnection', 'Merge', 'BackgroundMergesAndMutationsPoolTask', 'ReadonlyReplica')",
              ),
            ),
            quiet(
              clickhouse.select<{ metric: string; value: number }>(
                "SELECT metric, value FROM system.asynchronous_metrics WHERE metric IN ('MemoryResident', 'OSMemoryTotal', 'OSMemoryAvailable', 'LoadAverage1')",
              ),
            ),
            quiet(
              clickhouse.select<{ name: string; parts: string }>(
                `SELECT concat(database, '.', table) AS name, count() AS parts FROM system.parts WHERE active AND database NOT IN ${SYSTEM_DATABASES} GROUP BY database, table ORDER BY parts DESC LIMIT 5`,
              ),
            ),
            quiet(
              clickhouse.select<{
                name: string;
                mutation_id: string;
                command: string;
                reason: string;
              }>(
                "SELECT concat(database, '.', table) AS name, mutation_id, command, latest_fail_reason AS reason FROM system.mutations WHERE NOT is_done LIMIT 20",
              ),
            ),
            quiet(
              clickhouse.select<{
                name: string;
                readonly: number;
                queue: string;
                delay: string;
              }>(
                "SELECT concat(database, '.', table) AS name, is_readonly AS readonly, queue_size AS queue, absolute_delay AS delay FROM system.replicas WHERE is_readonly OR queue_size > 20 OR absolute_delay > 60 LIMIT 20",
              ),
            ),
            quiet(
              clickhouse.select<{
                name: string;
                code: number;
                value: string;
                last: string;
                message: string;
              }>(
                'SELECT name, code, value, last_error_time AS last, last_error_message AS message FROM system.errors ORDER BY last_error_time DESC LIMIT 15',
              ),
            ),
          ]);
        const metric = (name: string) =>
          metrics?.data.find((row) => row.metric === name)?.value;
        const mem = (name: string) =>
          memory?.data.find((row) => row.metric === name)?.value;
        return [
          metrics
            ? `Agora: ${num(metric('Query'))} consultas, ${num(metric('TCPConnection')) + num(metric('HTTPConnection'))} ligações, ${num(metric('Merge'))} merges${num(metric('ReadonlyReplica')) ? `, ${num(metric('ReadonlyReplica'))} réplicas só de leitura` : ''}.`
            : '',
          memory?.data.length
            ? `Memória: o ClickHouse usa ${bytes(mem('MemoryResident'))}${mem('OSMemoryTotal') ? ` de ${bytes(mem('OSMemoryTotal'))} (livres ${bytes(mem('OSMemoryAvailable'))})` : ''}${mem('LoadAverage1') !== undefined ? `, carga ${num(mem('LoadAverage1')).toFixed(2)}` : ''}.`
            : '',
          parts?.data.length
            ? `Mais partes: ${parts.data.map((row) => `${row.name} ${num(row.parts)}`).join(', ')}.`
            : '',
          mutations?.data.length
            ? `Mutações por acabar:\n${mutations.data.map((row) => `- ${row.name} ${row.mutation_id}: ${cell(row.command).slice(0, 120)}${row.reason ? ` — falha: ${cell(row.reason).slice(0, 200)}` : ''}`).join('\n')}`
            : 'Nenhuma mutação por acabar.',
          replicas?.data.length
            ? `Réplicas com problemas:\n${replicas.data.map((row) => `- ${row.name}${row.readonly ? ' só de leitura' : ''}, fila ${num(row.queue)}, atraso ${num(row.delay)} s`).join('\n')}`
            : '',
          errors?.data.length
            ? `Erros desde o arranque (os mais recentes):\n${errors.data.map((row) => `- ${row.last} ${row.name} (${row.code}) ×${num(row.value)}: ${cell(row.message).slice(0, 200)}`).join('\n')}`
            : 'Sem erros desde o arranque.',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
  ];
}
