import { docxMarkdown } from './docxMarkdown';
import { readCsv, readWorkbook } from './readWorkbook';
import { Table, profile, renderRows, toTable } from './sheetTable';

export type FileKind = 'pdf' | 'image' | 'word' | 'excel' | 'csv' | 'text';

/** O que se aceita no chat, pela extensão (o tipo do browser nem sempre vem certo). */
const KINDS: [RegExp, FileKind][] = [
  [/\.pdf$/i, 'pdf'],
  [/\.(png|jpe?g|gif|webp)$/i, 'image'],
  [/\.docx$/i, 'word'],
  [/\.(xlsx|xlsm)$/i, 'excel'],
  [/\.(csv|tsv)$/i, 'csv'],
  [/\.(txt|md|json|xml|log|ics|html?|ya?ml)$/i, 'text'],
];

export function kindOf(name: string, mimeType: string): FileKind | null {
  const byName = KINDS.find(([pattern]) => pattern.test(name))?.[1];
  if (byName) return byName;
  if (mimeType === 'application/pdf') return 'pdf';
  if (/^image\/(png|jpeg|gif|webp)$/.test(mimeType)) return 'image';
  if (/wordprocessingml/.test(mimeType)) return 'word';
  if (/spreadsheetml/.test(mimeType)) return 'excel';
  if (/^text\/csv$/.test(mimeType)) return 'csv';
  if (/^text\//.test(mimeType)) return 'text';
  return null;
}

/** Os formatos antigos do Office (binários): não se leem, e a mensagem diz o que fazer. */
export const isLegacyOffice = (name: string) => /\.(doc|xls|ppt)$/i.test(name);

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  image: 'imagem',
  word: 'Word',
  excel: 'Excel',
  csv: 'CSV',
  text: 'texto',
};

/** O tipo de imagem que a IA aceita (o browser às vezes manda "image/jpg"). */
export function imageType(name: string, mimeType: string) {
  const extension = /\.(\w+)$/.exec(name)?.[1].toLowerCase();
  const type = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  if (/^image\/(png|jpeg|gif|webp)$/.test(type)) {
    return type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  }
  return extension === 'png'
    ? 'image/png'
    : extension === 'gif'
      ? 'image/gif'
      : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
}

/** As páginas de um PDF, contadas pelos objetos /Page (null = não se consegue saber). */
export function pdfPages(data: Buffer): number | null {
  const count =
    data.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  return count || null;
}

export interface FileContent {
  kind: FileKind;
  /** Word e texto. */
  text?: string;
  /** Excel e CSV: uma tabela por folha. */
  tables?: Table[];
  /** PDF. */
  pages?: number | null;
}

/** O conteúdo de um ficheiro, lido no código (o PDF e as imagens vão inteiros à IA). */
export function readContent(
  name: string,
  mimeType: string,
  data: Buffer,
): FileContent {
  const kind = kindOf(name, mimeType);
  if (!kind) throw new Error(`não sei ler o formato de ${name}`);
  if (kind === 'word') return { kind, text: docxMarkdown(data) };
  if (kind === 'excel')
    return { kind, tables: readWorkbook(data).map(toTable) };
  if (kind === 'csv')
    return {
      kind,
      tables: [toTable(readCsv(data, name.replace(/\.\w+$/, '')))],
    };
  if (kind === 'text')
    return { kind, text: data.toString('utf8').replace(/^\uFEFF/, '') };
  if (kind === 'pdf') return { kind, pages: pdfPages(data) };
  return { kind };
}

/** Até onde vai o texto de um Word ou de um ficheiro de texto dentro da mensagem. */
export const INLINE_TEXT_CHARS = 120_000;
/** Até onde vão as linhas de todas as folhas dentro da mensagem; acima disso, um excerto. */
const INLINE_SHEET_CHARS = 80_000;
const EXCERPT_HEAD = 40;
const EXCERPT_TAIL = 5;

/** As folhas para o modelo: o perfil das colunas e as linhas (todas, ou o princípio e o fim). */
export function describeTables(tables: Table[]): string {
  const full = tables.map((table) => renderRows(table, table.rows));
  const fits =
    full.reduce((total, text) => total + text.length, 0) <= INLINE_SHEET_CHARS;
  return tables
    .map((table, index) => {
      const first = table.rows[0]?.line;
      const last = table.rows.at(-1)?.line;
      const head =
        `### Folha «${table.sheet}» — ${table.rows.length} linhas de dados × ${table.columns.length} colunas` +
        (first
          ? ` (linhas ${first}–${last} do Excel` +
            (table.headerRow
              ? `; cabeçalho na linha ${table.headerRow})`
              : '; sem cabeçalho)')
          : '');
      if (!table.rows.length) return `${head}\n(vazia)`;
      const rows = fits
        ? full[index]
        : table.rows.length <= EXCERPT_HEAD + EXCERPT_TAIL
          ? full[index]
          : [
              renderRows(table, table.rows.slice(0, EXCERPT_HEAD)),
              `… (${table.rows.length - EXCERPT_HEAD - EXCERPT_TAIL} linhas não mostradas — lê-as com chat_file_read ou faz as contas com chat_file_query)`,
              renderRows(table, table.rows.slice(-EXCERPT_TAIL))
                .split('\n')
                .slice(1)
                .join('\n'),
            ].join('\n');
      return `${head}\nColunas:\n${profile(table)
        .map((line) => `- ${line}`)
        .join('\n')}\n\n${rows}`;
    })
    .join('\n\n');
}

export const cutText = (text: string, from = 0, size = INLINE_TEXT_CHARS) =>
  text.length - from > size
    ? `${text.slice(from, from + size)}\n\n[… mostrados os caracteres ${from}–${from + size} de ${text.length}; o resto lê-se com chat_file_read e offset ${from + size}]`
    : text.slice(from);
