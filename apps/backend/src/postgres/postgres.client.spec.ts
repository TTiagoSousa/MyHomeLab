const queries: { text: unknown }[] = [];
let connectError: unknown = null;
let queryResult: unknown = { rows: [], fields: [] };

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation((config: unknown) => ({
    config,
    on: jest.fn(),
    connect: jest.fn(() =>
      connectError ? Promise.reject(connectError as Error) : Promise.resolve(),
    ),
    end: jest.fn(() => Promise.resolve()),
    query: jest.fn((text: unknown) => {
      queries.push({ text });
      return Promise.resolve(
        typeof text === 'string' ? { rows: [], fields: [] } : queryResult,
      );
    }),
  })),
}));

import { Client } from 'pg';
import {
  cleanPostgresHost,
  parsePostgresUrl,
  postgresConfig,
  postgresUrl,
  readOnlyQuery,
  withPostgres,
} from './postgres.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

describe('postgres client', () => {
  beforeEach(() => {
    queries.length = 0;
    connectError = null;
  });

  it('keeps the location in the url without the password', () => {
    const url = postgresUrl({
      host: 'db.exemplo.com',
      port: 5433,
      database: 'app',
      ssl: 'no-verify',
    });
    expect(url).toBe('postgres://db.exemplo.com:5433/app?sslmode=require');
    expect(parsePostgresUrl(url)).toEqual({
      host: 'db.exemplo.com',
      port: 5433,
      database: 'app',
      ssl: 'no-verify',
    });
    expect(cleanPostgresHost('https://postgres.exemplo.com/')).toEqual({
      host: 'postgres.exemplo.com',
      port: undefined,
    });
    const config = postgresConfig({ baseUrl: url, user: 'u', password: 'p' });
    expect(config).toMatchObject({
      host: 'db.exemplo.com',
      port: 5433,
      database: 'app',
      user: 'u',
      password: 'p',
      ssl: { rejectUnauthorized: false },
      statement_timeout: 60_000,
    });
  });

  it('reads in a read only transaction with a row cap', async () => {
    queryResult = {
      rows: [{ a: 1 }, { a: 2 }, { a: 3 }],
      fields: [{ name: 'a' }],
    };
    const client = new Client();
    const { result, truncated } = await readOnlyQuery(
      client,
      'SELECT a FROM t;',
      2,
    );
    expect(queries[0].text).toBe('BEGIN READ ONLY');
    expect(queries[1].text).toBe('SAVEPOINT leitura');
    expect(queries[2].text).toBe('SET LOCAL ROLE pg_read_all_data');
    expect(queries[3].text).toMatchObject({
      text: 'SELECT * FROM (\nSELECT a FROM t\n) AS consulta LIMIT 3',
      queryMode: 'extended',
    });
    expect(queries[4].text).toBe('ROLLBACK');
    expect(result.rows).toEqual([{ a: 1 }, { a: 2 }]);
    expect(truncated).toBe(true);
  });

  it('refuses COPY … TO PROGRAM before touching the server', async () => {
    const client = new Client();
    await expect(
      readOnlyQuery(client, "COPY (SELECT 1) TO PROGRAM 'sh'", 2),
    ).rejects.toThrow(/só aceita leituras/);
    expect(queries).toHaveLength(0);
  });

  it('maps a wrong password', async () => {
    connectError = Object.assign(new Error('password authentication failed'), {
      code: '28P01',
    });
    await expect(
      withPostgres(
        {
          baseUrl: 'postgres://h:5432/db?sslmode=disable',
          user: 'u',
          password: 'x',
        },
        () => Promise.resolve(1),
      ),
    ).rejects.toBeInstanceOf(AppIntegrationError);
  });
});
