import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  createClickhouseClient,
  num,
  quoteName,
} from 'src/clickhouse/clickhouse.client';
import { BackupFile } from './backupSources';

const SYSTEM_DATABASES =
  "('system', 'INFORMATION_SCHEMA', 'information_schema')";

/**
 * O backup do ClickHouse: só o esquema, num JSON — o CREATE de cada base de dados, tabela,
 * vista, vista materializada e dicionário, as funções SQL do utilizador e, se este utilizador
 * puder (SHOW ACCESS), os utilizadores, os papéis, as quotas e os grants. Os dados não entram
 * (são grandes demais para isto): para os dados usa o BACKUP … TO Disk/S3 do próprio ClickHouse
 * ou o backup do CT/VM. O que não se conseguiu ler fica em `missing`.
 */
export async function clickhouseBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.username) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O ClickHouse já não tem login. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createClickhouseClient(
    account.baseUrl,
    account.username,
    account.accessToken ?? '',
  );
  const missing: string[] = [];
  const version = await client.version();

  const databases = (
    await client.select<{ name: string; engine: string }>(
      `SELECT name, engine FROM system.databases WHERE name NOT IN ${SYSTEM_DATABASES} ORDER BY name`,
      100_000,
    )
  ).data;
  const databaseCreates: { name: string; engine: string; create: string }[] =
    [];
  for (const database of databases) {
    try {
      databaseCreates.push({
        ...database,
        create: (
          await client.raw(`SHOW CREATE DATABASE ${quoteName(database.name)}`)
        ).trim(),
      });
    } catch (error) {
      missing.push(
        `base ${database.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const tables = (
    await client.select<{
      database: string;
      name: string;
      engine: string;
      total_rows: string | null;
      total_bytes: string | null;
      create_table_query: string;
    }>(
      `SELECT database, name, engine, total_rows, total_bytes, create_table_query
       FROM system.tables
       WHERE database NOT IN ${SYSTEM_DATABASES} AND NOT is_temporary
       ORDER BY database, (engine IN ('View', 'MaterializedView', 'Dictionary')), name`,
      100_000,
    )
  ).data.map((table) => ({
    database: table.database,
    name: table.name,
    engine: table.engine,
    rows: table.total_rows === null ? null : num(table.total_rows),
    bytes: table.total_bytes === null ? null : num(table.total_bytes),
    create: table.create_table_query,
  }));

  const functions = await client
    .select<{ name: string; create_query: string }>(
      "SELECT name, create_query FROM system.functions WHERE origin = 'SQLUserDefined' ORDER BY name",
      10_000,
    )
    .then((result) => result.data)
    .catch((error: unknown) => {
      missing.push(
        `funções: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    });

  const access = await client
    .raw('SHOW ACCESS')
    .then((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .catch(() => {
      missing.push(
        'utilizadores, papéis e grants (este utilizador não pode fazer SHOW ACCESS)',
      );
      return [] as string[];
    });

  const content = Buffer.from(
    JSON.stringify(
      {
        app: 'clickhouse',
        createdAt: new Date().toISOString(),
        version,
        user: account.username,
        databases: databaseCreates,
        tables,
        functions,
        access,
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
