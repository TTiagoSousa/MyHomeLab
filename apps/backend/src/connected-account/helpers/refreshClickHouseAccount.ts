import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { createClickhouseClient, num } from 'src/clickhouse/clickhouse.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O ClickHouse visto agora: o utilizador, há quanto tempo corre, as bases, o tamanho e o disco. */
export async function refreshClickHouseAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.CLICKHOUSE) {
    throw new BadRequestException('Esta conta não é um ClickHouse');
  }
  if (!account.baseUrl || !account.username) {
    throw new BadRequestException(
      'O ClickHouse já não tem login. Liga-o outra vez.',
    );
  }
  try {
    const client = createClickhouseClient(
      account.baseUrl,
      account.username,
      account.accessToken ?? '',
    );
    const [me, uptime, databases, parts, disks, running] = await Promise.all([
      client.whoami(),
      client.select<{ uptime: string }>('SELECT uptime() AS uptime'),
      client.select<{ name: string }>(
        "SELECT name FROM system.databases WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') ORDER BY name",
      ),
      client
        .select<{ bytes: string; rows: string; tables: string }>(
          'SELECT sum(bytes_on_disk) AS bytes, sum(rows) AS rows, uniqExact(database, table) AS tables FROM system.parts WHERE active',
        )
        .catch(() => null),
      client
        .select<{ free: string; total: string }>(
          'SELECT sum(free_space) AS free, sum(total_space) AS total FROM system.disks',
        )
        .catch(() => null),
      client
        .select<{ count: string }>(
          'SELECT count() AS count FROM system.processes',
        )
        .catch(() => null),
    ]);
    const size = parts?.data[0];
    const disk = disks?.data[0];
    return {
      account,
      profile: me.user,
      uptimeSeconds: num(uptime.data[0]?.uptime),
      databases: databases.data.map((item) => item.name),
      tables: size ? num(size.tables) : null,
      rows: size ? num(size.rows) : null,
      bytes: size ? num(size.bytes) : null,
      diskFree: disk ? num(disk.free) : null,
      diskTotal: disk ? num(disk.total) : null,
      running: running ? num(running.data[0]?.count) : null,
    };
  } catch (error) {
    throw new BadRequestException(
      `O ClickHouse não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
