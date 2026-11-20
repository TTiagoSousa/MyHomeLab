import { decodeXml, unzip } from 'src/utils/office/officeText';

export type CellValue = string | number | boolean | null;

/** Uma folha: as linhas com valores e, para cada uma, o número dela no Excel. */
export interface Sheet {
  name: string;
  rows: CellValue[][];
  rowNumbers: number[];
}

// Os formatos de número que o Excel traz de origem e são datas ou horas.
const BUILTIN_DATES = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

/** Um formato próprio é de data se tiver d, m, y, h ou s fora de texto e de [cor]. */
const isDateCode = (code: string) =>
  /[dmyhs]/i.test(
    code
      .replace(/"[^"]*"/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\\./g, ''),
  );

/** Os estilos de célula (o índice do atributo s) que mostram datas. */
function dateStyles(xml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const match of xml.matchAll(
    /<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g,
  )) {
    custom.set(Number(match[1]), decodeXml(match[2]));
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '';
  const dates = new Set<number>();
  [...cellXfs.matchAll(/<xf\b([^>]*)/g)].forEach((match, index) => {
    const id = Number(/numFmtId="(\d+)"/.exec(match[1])?.[1] ?? 0);
    const code = custom.get(id);
    if (BUILTIN_DATES.has(id) || (code && isDateCode(code))) dates.add(index);
  });
  return dates;
}

/** "AB12" → 27 (a coluna, a contar do zero). */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  return (
    [...letters].reduce(
      (total, char) => total * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

/** 27 → "AB". */
export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Um número de série do Excel como data ISO ("2026-11-19", "2026-11-19 14:30" ou "14:30"). */
function serialDate(serial: number, date1904: boolean): string {
  const days = serial + (date1904 ? 1462 : 0);
  const date = new Date(Math.round((days - 25569) * 86_400_000));
  if (Number.isNaN(date.getTime())) return String(serial);
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  if (serial < 1) return time;
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return Number.isInteger(serial) ? day : `${day} ${time}`;
}

/** O texto de um <si> ou <is>: as partes <t> juntas, sem a fonética (<rPh>). */
const richText = (xml: string) =>
  decodeXml(
    [
      ...xml
        .replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
        .matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g),
    ]
      .map((match) => match[1])
      .join(''),
  );

/** O caminho de uma folha a partir do Target das relações do workbook. */
const sheetPath = (target: string) =>
  target.startsWith('/')
    ? target.slice(1)
    : `xl/${target.replace(/^\.\//, '')}`;

/**
 * As folhas de um Excel (.xlsx, .xlsm) com os valores de cada célula no sítio certo
 * (as colunas vazias contam), as datas como datas e as fórmulas pelo último valor
 * calculado. Pela ordem das folhas no livro.
 */
export function readWorkbook(data: Buffer): Sheet[] {
  const files = unzip(data, (name) =>
    /^xl\/(sharedStrings\.xml|workbook\.xml|styles\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(
      name,
    ),
  );
  const text = (name: string) => files.get(name)?.toString('utf8') ?? '';
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error('não é um livro do Excel (.xlsx)');
  const date1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(workbook);
  const shared = [
    ...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((match) => richText(match[1]));
  const dates = dateStyles(text('xl/styles.xml'));
  const targets = new Map(
    [
      ...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)/g),
    ].map((match) => [
      /\bId="([^"]+)"/.exec(match[1])?.[1] ?? '',
      sheetPath(/\bTarget="([^"]+)"/.exec(match[1])?.[1] ?? ''),
    ]),
  );
  const declared = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(
    (match, index) => ({
      name: decodeXml(
        /\bname="([^"]*)"/.exec(match[1])?.[1] ?? `Folha ${index + 1}`,
      ),
      path:
        targets.get(/\br:id="([^"]+)"/.exec(match[1])?.[1] ?? '') ??
        `xl/worksheets/sheet${index + 1}.xml`,
    }),
  );

  return declared
    .filter((sheet) => files.has(sheet.path))
    .map((sheet) => {
      const xml = text(sheet.path);
      const rows: CellValue[][] = [];
      const rowNumbers: number[] = [];
      let nextRow = 1;
      for (const row of xml.matchAll(
        /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,
      )) {
        const number = Number(/\br="(\d+)"/.exec(row[1])?.[1] ?? nextRow);
        nextRow = number + 1;
        const cells: CellValue[] = [];
        let nextColumn = 0;
        for (const cell of (row[2] ?? '').matchAll(
          /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
        )) {
          const attributes = cell[1];
          const ref = /\br="([A-Z]+)\d*"/i.exec(attributes)?.[1];
          const column = ref ? columnIndex(ref) : nextColumn;
          nextColumn = column + 1;
          const type = /\bt="(\w+)"/.exec(attributes)?.[1] ?? 'n';
          const body = cell[2] ?? '';
          const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
          let value: CellValue = null;
          if (type === 'inlineStr') value = richText(body);
          else if (raw === undefined) value = null;
          else if (type === 's') value = shared.at(Number(raw)) ?? '';
          else if (type === 'b') value = raw === '1';
          else if (type === 'str' || type === 'e' || type === 'd')
            value = decodeXml(raw);
          else {
            const number = Number(raw);
            const style = Number(/\bs="(\d+)"/.exec(attributes)?.[1] ?? -1);
            value = Number.isNaN(number)
              ? decodeXml(raw)
              : dates.has(style)
                ? serialDate(number, date1904)
                : number;
          }
          if (value === '' || value === null) continue;
          cells[column] = value;
        }
        if (!cells.length) continue;
        rows.push(Array.from(cells, (value) => value ?? null));
        rowNumbers.push(number);
      }
      return { name: sheet.name, rows, rowNumbers };
    });
}

/** O separador de um CSV: o que mais aparece na primeira linha (fora de aspas). */
function delimiterOf(text: string): string {
  const end = text.search(/\r?\n/);
  const firstLine = (end < 0 ? text : text.slice(0, end)).replace(
    /"[^"]*"/g,
    '',
  );
  const counts = [',', ';', '\t', '|'].map((char) => ({
    char,
    count: firstLine.split(char).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0].count
    ? counts[0].char
    : ',';
}

/** Um CSV (vírgula, ponto e vírgula, tab ou |, com aspas à RFC 4180) como uma folha. */
export function readCsv(data: Buffer, name: string): Sheet {
  const text = data.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = delimiterOf(text);
  const rows: CellValue[][] = [];
  const rowNumbers: number[] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row.map((value) => (value.trim() === '' ? null : value)));
      rowNumbers.push(line);
    }
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
    } else field += char;
  }
  if (field !== '' || row.length) endRow();
  return { name, rows, rowNumbers };
}
