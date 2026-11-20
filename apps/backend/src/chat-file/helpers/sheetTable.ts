import { CellValue, Sheet, columnIndex, columnLetter } from './readWorkbook';

/** Uma folha como tabela: os nomes das colunas e as linhas de dados (com o número no Excel). */
export interface Table {
  sheet: string;
  columns: string[];
  /** A linha do cabeçalho no Excel (null = a folha não tem cabeçalho). */
  headerRow: number | null;
  rows: { line: number; cells: CellValue[] }[];
}

const isLabel = (value: CellValue) =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  !/^[\d\s.,€$%:/-]+$/.test(value);

/**
 * O cabeçalho é a primeira linha (das cinco primeiras) com pelo menos duas células e só
 * texto, e com tantas células como as linhas de baixo. Sem isso, as colunas ficam A, B, C…
 */
export function toTable(sheet: Sheet): Table {
  const width = Math.max(0, ...sheet.rows.map((row) => row.length));
  let header = -1;
  for (let i = 0; i < Math.min(5, sheet.rows.length - 1); i++) {
    const filled = sheet.rows[i].filter((value) => value !== null);
    if (
      filled.length >= Math.min(2, width) &&
      filled.every(isLabel) &&
      filled.length >= width * 0.5
    ) {
      header = i;
      break;
    }
  }
  const seen = new Map<string, number>();
  const columns = Array.from({ length: width }, (_, index) => {
    const label = header >= 0 ? sheet.rows[header][index] : null;
    const base =
      label === null || label === undefined
        ? columnLetter(index)
        : String(label).trim();
    const count = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), count);
    return count > 1 ? `${base} (${count})` : base;
  });
  return {
    sheet: sheet.name,
    columns,
    headerRow: header >= 0 ? sheet.rowNumbers[header] : null,
    rows: sheet.rows.slice(header + 1).map((cells, index) => ({
      line: sheet.rowNumbers[header + 1 + index],
      cells,
    })),
  };
}

/** Sem acentos nem maiúsculas: "Município" = "municipio". */
export const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** A coluna pelo nome (sem acentos nem maiúsculas), pela letra do Excel ("C") ou pelo número (1 = a primeira). */
export function resolveColumn(table: Table, name: string): number {
  const wanted = fold(String(name));
  const byName = table.columns.findIndex((column) => fold(column) === wanted);
  if (byName >= 0) return byName;
  if (/^[a-z]{1,3}$/.test(wanted)) {
    const index = columnIndex(wanted.toUpperCase());
    if (index < table.columns.length) return index;
  }
  if (
    /^\d+$/.test(wanted) &&
    Number(wanted) >= 1 &&
    Number(wanted) <= table.columns.length
  ) {
    return Number(wanted) - 1;
  }
  const partial = table.columns.filter((column) =>
    fold(column).includes(wanted),
  );
  if (partial.length === 1) return table.columns.indexOf(partial[0]);
  throw new Error(
    `Não há a coluna "${name}" na folha «${table.sheet}». As colunas são: ${table.columns.map((column, index) => `${columnLetter(index)} «${column}»`).join(', ')}.`,
  );
}

/**
 * Um valor como número, se o for: 12, "12,5", "1.234,56 €", "1,234.56", "(30)", "15%".
 * Com só vírgula ou só ponto, é o separador decimal; com vários grupos de três, é milhares.
 */
export function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  let text = value
    .replace(/[\s\u00a0€$£%]/g, '')
    .replace(/^(EUR|USD)|(EUR|USD)$/i, '');
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);
  if (!/^[-+]?(\d[\d.,]*)$/.test(text)) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text =
      comma > dot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = /^[-+]?\d{1,3}(,\d{3}){2,}$/.test(text)
      ? text.replace(/,/g, '')
      : text.replace(/,/g, '.');
  } else if (/^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const number = Number(text);
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}

const isDate = (value: CellValue) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(value);

/** Um número para mostrar: sem o ruído das vírgulas flutuantes (0.30000000000000004). */
export const formatNumber = (value: number) =>
  String(Number(value.toPrecision(15)));

export const show = (value: CellValue) =>
  value === null
    ? ''
    : typeof value === 'number'
      ? formatNumber(value)
      : typeof value === 'boolean'
        ? value
          ? 'VERDADEIRO'
          : 'FALSO'
        : value.replace(/\s*\n\s*/g, ' ⏎ ').replace(/\|/g, '¦');

/** Uma linha do perfil de cada coluna: o tipo, quantas preenchidas, distintos, somas e intervalos. */
export function profile(table: Table): string[] {
  return table.columns.map((column, index) => {
    const values = table.rows
      .map((row) => row.cells[index] ?? null)
      .filter((value) => value !== null);
    const label = `${columnLetter(index)} «${column}»`;
    if (!values.length) return `${label}: vazia`;
    const numbers = values
      .map(toNumber)
      .filter((value): value is number => value !== null);
    const dates = values.filter(isDate) as string[];
    const distinct = new Set(values.map((value) => fold(show(value)))).size;
    const filled = `${values.length}/${table.rows.length} preenchidas, ${distinct} distintos`;
    if (numbers.length >= values.length * 0.8) {
      const sum = numbers.reduce((total, value) => total + value, 0);
      const min = numbers.reduce(
        (low, value) => Math.min(low, value),
        Infinity,
      );
      const max = numbers.reduce(
        (high, value) => Math.max(high, value),
        -Infinity,
      );
      return `${label}: número (${filled}; soma ${formatNumber(sum)}, mín ${formatNumber(min)}, máx ${formatNumber(max)}${numbers.length < values.length ? `; ${values.length - numbers.length} não numéricas` : ''})`;
    }
    if (dates.length >= values.length * 0.8) {
      const sorted = [...dates].sort();
      return `${label}: data (${filled}; de ${sorted[0]} a ${sorted.at(-1)})`;
    }
    const examples = [...new Set(values.slice(0, 40).map(show))]
      .slice(0, 3)
      .map((value) => `«${value.slice(0, 40)}»`);
    return `${label}: texto (${filled}; ex.: ${examples.join(', ')})`;
  });
}

/** As linhas como tabela de texto, com o número da linha no Excel à frente. */
export function renderRows(
  table: Table,
  rows: Table['rows'],
  columns?: number[],
): string {
  const picked = columns ?? table.columns.map((_, index) => index);
  const head = `linha | ${picked.map((index) => table.columns[index]).join(' | ')}`;
  return [
    head,
    ...rows.map(
      (row) =>
        `${row.line} | ${picked.map((index) => show(row.cells[index] ?? null)).join(' | ')}`,
    ),
  ].join('\n');
}
