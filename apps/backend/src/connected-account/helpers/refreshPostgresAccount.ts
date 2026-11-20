import { BadRequestException } from '@nestjs/common';
import { PrismaConnectedAccountRepository } from '../repositories/prisma/prisma-connected-account-repository';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { parsePostgresUrl, withPostgres } from 'src/postgres/postgres.client';
import { findConnectedAccount } from './findConnectedAccount';

/** O PostgreSQL visto agora: o utilizador, a base, as bases com o tamanho, as ligações e há quanto tempo corre. */
export async function refreshPostgresAccount(
  id: string,
  userId: string,
  repository: PrismaConnectedAccountRepository,
) {
  const account = await findConnectedAccount(id, userId, repository);
  if (account.provider !== ConnectionProvider.POSTGRES) {
    throw new BadRequestException('Esta conta não é um PostgreSQL');
  }
  if (!account.baseUrl || !account.username || !account.accessToken) {
    throw new BadRequestException(
      'O PostgreSQL já não tem password. Liga-o outra vez.',
    );
  }
  const location = parsePostgresUrl(account.baseUrl);
  try {
    return await withPostgres(
      {
        baseUrl: account.baseUrl,
        user: account.username,
        password: account.accessToken,
      },
      async (client) => {
        const facts = await client.query<{
          user: string;
          superuser: boolean;
          uptime: number;
          connections: number;
          max: number;
          recovery: boolean;
          version: string;
        }>(
          `SELECT current_user AS user,
             (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
             extract(epoch FROM now() - pg_postmaster_start_time())::int AS uptime,
             (SELECT count(*)::int FROM pg_stat_activity) AS connections,
             current_setting('max_connections')::int AS max,
             pg_is_in_recovery() AS recovery,
             current_setting('server_version') AS version`,
        );
        const databases = await client.query<{
          name: string;
          size: string | null;
        }>(
          `SELECT datname AS name, CASE WHEN has_database_privilege(datname, 'CONNECT') THEN pg_database_size(datname) END AS size
           FROM pg_database WHERE NOT datistemplate AND datallowconn ORDER BY 2 DESC NULLS LAST`,
        );
        const row = facts.rows[0];
        return {
          account,
          profile: row.user,
          superuser: row.superuser,
          database: location.database,
          ssl: location.ssl,
          uptimeSeconds: row.uptime,
          connections: row.connections,
          maxConnections: row.max,
          standby: row.recovery,
          serverVersion: `v${row.version.split(' ')[0]}`,
          databases: databases.rows.map((item) => ({
            name: item.name,
            bytes: item.size === null ? null : Number(item.size),
          })),
        };
      },
    );
  } catch (error) {
    throw new BadRequestException(
      `O PostgreSQL não respondeu: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
