import { CellValue, columnLetter } from './readWorkbook';
import {
  Table,
  fold,
  formatNumber,
  renderRows,
  resolveColumn,
  show,
  toNumber,
} from './sheetTable';

export type FilterOp =
  | '='
  | '!='
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | '>'
  | '>='
  | '<'
  | '<='
  | 'empty'
  | 'not_empty'
  | 'in';

export interface Filter {
  column: string;
  op: FilterOp;
  value?: string | number | boolean | (string | number)[];
}

export type AggregateFn =
  'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';

export interface TableQuery {
  where?: Filter[];
  /** Todas as condições (omissão) ou basta uma. */
  match?: 'all' | 'any';
  columns?: string[];
  groupBy?: string[];
  aggregates?: { fn: AggregateFn; column?: string }[];
  duplicatesBy?: string[];
  sort?: { column: string; desc?: boolean }[];
  offset?: number;
  limit?: number;
}

const MAX_LIMIT = 500;

/** Compara dois valores: como números se os dois o forem, senão como texto (datas ISO incluídas). */
function compare(a: CellValue, b: CellValue): number {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x !== null && y !== null) return x - y;
  return fold(show(a)).localeCompare(fold(show(b)), 'pt');
}

function test(cell: CellValue, filter: Filter): boolean {
  const empty = cell === null || show(cell).trim() === '';
  if (filter.op === 'empty') return empty;
  if (filter.op === 'not_empty') return !empty;
  if (filter.op === 'in') {
    const options = Array.isArray(filter.value) ? filter.value : [filter.value];
    return options.some((option) => compare(cell, option ?? null) === 0);
  }
  const value =
    (Array.isArray(filter.value) ? filter.value[0] : filter.value) ?? null;
  const text = fold(show(cell));
  const wanted = fold(show(value));
  switch (filter.op) {
    case '=':
      return compare(cell, value) === 0;
    case '!=':
      return compare(cell, value) !== 0;
    case 'contains':
      return text.includes(wanted);
    case 'not_contains':
      return !text.includes(wanted);
    case 'starts_with':
      return text.startsWith(wanted);
    case 'ends_with':
      return text.endsWith(wanted);
    default: {
      if (empty) return false;
      const order = compare(cell, value);
      return filter.op === '>'
        ? order > 0
        : filter.op === '>='
          ? order >= 0
          : filter.op === '<'
            ? order < 0
            : order <= 0;
    }
  }
}

/** O resultado de uma função sobre as células de uma coluna, com o que ficou de fora. */
function aggregate(fn: AggregateFn, values: CellValue[]): string {
  const filled = values.filter(
    (value) => value !== null && show(value).trim() !== '',
  );
  if (fn === 'count') return String(values.length);
  if (fn === 'count_distinct')
    return String(new Set(filled.map((value) => fold(show(value)))).size);
  if (fn === 'min' || fn === 'max') {
    if (!filled.length) return '—';
    const sorted = [...filled].sort(compare);
    return show(fn === 'min' ? sorted[0] : sorted[sorted.length - 1]);
  }
  const numbers = filled
    .map(toNumber)
    .filter((value): value is number => value !== null);
  const skipped = filled.length - numbers.length;
  if (!numbers.length) return skipped ? `— (${skipped} não numéricas)` : '—';
  const sum = numbers.reduce((total, value) => total + value, 0);
  const result = formatNumber(fn === 'sum' ? sum : sum / numbers.length);
  return skipped ? `${result} (${skipped} não numéricas ignoradas)` : result;
}

const keyOf = (cells: CellValue[], columns: number[]) =>
  columns.map((index) => fold(show(cells[index] ?? null))).join('\u0001');

/**
 * Filtra, agrupa, soma e encontra duplicados numa folha, no código — os números saem
 * certos, sem o modelo contar linhas a olho. Devolve o resultado em texto.
 */
export function queryTable(table: Table, query: TableQuery): string {
  const where = (query.where ?? []).map((filter) => ({
    ...filter,
    index: resolveColumn(table, filter.column),
  }));
  const rows = table.rows.filter((row) =>
    !where.length
      ? true
      : query.match === 'any'
        ? where.some((filter) => test(row.cells[filter.index] ?? null, filter))
        : where.every((filter) =>
            test(row.cells[filter.index] ?? null, filter),
          ),
  );
  const limit = Math.min(Math.max(query.limit ?? 100, 1), MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);
  const head = `Folha «${table.sheet}»: ${rows.length} de ${table.rows.length} linhas de dados${where.length ? ' cumprem o filtro' : ''}.`;

  if (query.duplicatesBy?.length) {
    const columns = query.duplicatesBy.map((name) =>
      resolveColumn(table, name),
    );
    const groups = new Map<string, Table['rows']>();
    for (const row of rows) {
      if (
        columns.every(
          (index) =>
            row.cells[index] === null || row.cells[index] === undefined,
        )
      )
        continue;
      const key = keyOf(row.cells, columns);
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    const repeated = [...groups.values()].filter((group) => group.length > 1);
    if (!repeated.length)
      return `${head}\nSem duplicados por ${columns.map((index) => table.columns[index]).join(' + ')}.`;
    const lines = repeated
      .slice(offset, offset + limit)
      .map(
        (group) =>
          `${columns.map((index) => `${table.columns[index]}=${show(group[0].cells[index] ?? null)}`).join(', ')}: ${group.length} vezes (linhas ${group.map((row) => row.line).join(', ')})`,
      );
    return [
      head,
      `${repeated.length} valores repetidos (${repeated.reduce((total, group) => total + group.length, 0)} linhas) por ${columns.map((index) => table.columns[index]).join(' + ')}:`,
      ...lines,
      repeated.length > offset + limit
        ? `… e mais ${repeated.length - offset - limit} (usa offset).`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (query.groupBy?.length || query.aggregates?.length) {
    const groupColumns = (query.groupBy ?? []).map((name) =>
      resolveColumn(table, name),
    );
    const aggregates = (
      query.aggregates?.length ? query.aggregates : [{ fn: 'count' as const }]
    ).map((entry) => ({
      ...entry,
      index: entry.column ? resolveColumn(table, entry.column) : null,
    }));
    for (const entry of aggregates) {
      if (entry.fn !== 'count' && entry.index === null) {
        throw new Error(`A função ${entry.fn} precisa de uma coluna.`);
      }
    }
    const groups = new Map<string, Table['rows']>();
    for (const row of rows) {
      const key = keyOf(row.cells, groupColumns);
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    const labels = [
      ...groupColumns.map((index) => table.columns[index]),
      ...aggregates.map((entry) =>
        entry.index === null
          ? entry.fn
          : `${entry.fn}(${table.columns[entry.index]})`,
      ),
    ];
    let result = [...groups.values()].map((group) => [
      ...groupColumns.map((index) => show(group[0].cells[index] ?? null)),
      ...aggregates.map((entry) =>
        aggregate(
          entry.fn,
          entry.index === null
            ? group.map(() => 1)
            : group.map((row) => row.cells[entry.index!] ?? null),
        ),
      ),
    ]);
    const sort = query.sort?.[0];
    const sortAt = sort
      ? labels.findIndex((label) => fold(label) === fold(sort.column))
      : -1;
    if (sortAt >= 0) {
      result.sort(
        (a, b) => compare(a[sortAt], b[sortAt]) * (sort!.desc ? -1 : 1),
      );
    } else if (groupColumns.length) {
      result.sort((a, b) => compare(a[0], b[0]));
    }
    const total = result.length;
    result = result.slice(offset, offset + limit);
    return [
      head,
      groupColumns.length ? `${total} grupos.` : '',
      labels.join(' | '),
      ...result.map((cells) => cells.join(' | ')),
      total > offset + limit
        ? `… e mais ${total - offset - limit} grupos (usa offset).`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const sorts = (query.sort ?? []).map((entry) => ({
    index: resolveColumn(table, entry.column),
    desc: Boolean(entry.desc),
  }));
  const ordered = sorts.length
    ? [...rows].sort((a, b) => {
        for (const entry of sorts) {
          const order = compare(
            a.cells[entry.index] ?? null,
            b.cells[entry.index] ?? null,
          );
          if (order) return entry.desc ? -order : order;
        }
        return a.line - b.line;
      })
    : rows;
  const columns = query.columns?.length
    ? query.columns.map((name) => resolveColumn(table, name))
    : undefined;
  const page = ordered.slice(offset, offset + limit);
  return [
    head,
    page.length ? renderRows(table, page, columns) : 'Nenhuma linha.',
    ordered.length > offset + limit
      ? `… mostradas ${offset + 1}–${offset + page.length}; há mais ${ordered.length - offset - page.length} (usa offset).`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const describeColumns = (table: Table) =>
  table.columns
    .map((column, index) => `${columnLetter(index)} «${column}»`)
    .join(', ');
