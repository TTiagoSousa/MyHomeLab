/**
 * O que o postgres_query aceita. A transação READ ONLY trava as escritas em tabelas,
 * mas não o resto: COPY … TO PROGRAM corre programas no servidor, e há funções que
 * matam ligações, leem ficheiros do disco ou falam com outras bases (dblink). Uma
 * consulta de leitura começa por SELECT/WITH/VALUES/TABLE/EXPLAIN/SHOW e não chama
 * nenhuma dessas funções; um EXPLAIN ANALYZE corre a instrução, por isso também não.
 */
const READ_START = /^\s*(select|with|values|table|explain|show)\b/i;

const DANGEROUS =
  /\b(pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_promote|pg_read_file|pg_read_binary_file|pg_ls_\w+|pg_stat_file|lo_import|lo_export|lo_\w*write\w*|dblink\w*|set_config|pg_sleep\w*|pg_advisory\w*|pg_switch_wal|pg_create_\w+|pg_drop_\w+|pg_replication_\w+|txid_current|nextval|setval)\s*\(/i;

/** Tira os comentários e o texto entre aspas, para não se enganar com o que lá está. */
function code(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''");
}

/** O motivo da recusa (vai para o modelo), ou null se for uma leitura. */
export function readOnlyStatementProblem(sql: string): string | null {
  const text = code(sql)
    .trim()
    .replace(/;+\s*$/, '');
  if (!READ_START.test(text)) {
    return 'O postgres_query só aceita leituras (SELECT, WITH, VALUES, TABLE, EXPLAIN, SHOW). Para o resto usa postgres_execute.';
  }
  if (/;\s*\S/.test(text)) return 'Uma instrução de cada vez.';
  if (/^\s*explain\b[^;]*\banalyze\b/i.test(text)) {
    return 'EXPLAIN ANALYZE corre a instrução: no postgres_query só EXPLAIN (sem ANALYZE).';
  }
  if (/\bcopy\b/i.test(text) || /\bprogram\b/i.test(text)) {
    return 'COPY não é uma leitura: usa postgres_execute (e só quando ele pedir).';
  }
  const call = DANGEROUS.exec(text);
  if (call) {
    return `${call[1]}() não é uma leitura: usa postgres_execute (e só quando ele pedir).`;
  }
  return null;
}
