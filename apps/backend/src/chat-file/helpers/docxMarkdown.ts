import { decodeXml, unzip } from 'src/utils/office/officeText';

/** O texto de um parágrafo do Word, com tabs e quebras de linha no sítio. */
const paragraphText = (xml: string) =>
  decodeXml(
    [
      ...xml.matchAll(
        /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab)\/>|<w:(br|cr)\b[^>]*\/>/g,
      ),
    ]
      .map((match) => (match[2] ? '\t' : match[3] ? '\n' : match[1]))
      .join(''),
  ).trim();

/** "Heading2", "Ttulo2", "Title" → o nível do título em Markdown (null = parágrafo). */
function headingLevel(paragraph: string): number | null {
  const style = /<w:pStyle w:val="([^"]+)"/.exec(paragraph)?.[1] ?? '';
  if (/^(title|t[ií]tulo)$/i.test(style)) return 1;
  const level = /^(?:heading|t[ií]?tulo|cabe\w*)\s*(\d)$/i.exec(style)?.[1];
  return level ? Math.min(Number(level) + 1, 6) : null;
}

function paragraph(xml: string): string {
  const text = paragraphText(xml);
  if (!text) return '';
  const level = headingLevel(xml);
  if (level) return `${'#'.repeat(level)} ${text}`;
  if (/<w:numPr>/.test(xml)) {
    const depth = Number(/<w:ilvl w:val="(\d+)"/.exec(xml)?.[1] ?? 0);
    return `${'  '.repeat(depth)}- ${text}`;
  }
  return text;
}

/** Uma tabela do Word em Markdown: a primeira linha é o cabeçalho. */
function table(xml: string): string {
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
        .map((p) => paragraphText(p[0]).replace(/\s*\n\s*/g, ' '))
        .filter(Boolean)
        .join(' / ')
        .replace(/\|/g, '¦'),
    ),
  );
  if (!rows.length) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
  return [
    line(rows[0]),
    `|${' --- |'.repeat(width)}`,
    ...rows.slice(1).map(line),
  ].join('\n');
}

/** O corpo de um XML do Word, pela ordem: parágrafos e tabelas. */
function body(xml: string): string {
  return [
    ...xml.matchAll(
      /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g,
    ),
  ]
    .map((block) =>
      block[0].startsWith('<w:tbl>') ? table(block[0]) : paragraph(block[0]),
    )
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Um Word (.docx) em Markdown: títulos, listas e tabelas no sítio, e no fim as notas de
 * rodapé, os comentários e o cabeçalho e o rodapé das páginas. É o que o modelo lê.
 */
export function docxMarkdown(data: Buffer): string {
  const files = unzip(data, (name) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(
      name,
    ),
  );
  const text = (name: string) => files.get(name)?.toString('utf8') ?? '';
  const document = text('word/document.xml');
  if (!document) throw new Error('não é um documento do Word (.docx)');
  const main = body(
    /<w:body>([\s\S]*)<\/w:body>/.exec(document)?.[1] ?? document,
  );
  const extra = (title: string, names: string[]) => {
    const content = names
      .map((name) => body(text(name)))
      .filter(Boolean)
      .join('\n\n');
    return content ? `\n\n---\n**${title}**\n\n${content}` : '';
  };
  const pages = [...files.keys()].filter((name) =>
    /^word\/(header|footer)\d*\.xml$/.test(name),
  );
  const comments = [
    ...text('word/comments.xml').matchAll(
      /<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g,
    ),
  ]
    .map((match) => {
      const author = decodeXml(/w:author="([^"]*)"/.exec(match[1])?.[1] ?? '');
      return `- ${author ? `${author}: ` : ''}${body(match[2]).replace(/\n+/g, ' ')}`;
    })
    .join('\n');
  return (
    main +
    extra('Notas de rodapé e finais', [
      'word/footnotes.xml',
      'word/endnotes.xml',
    ]) +
    (comments ? `\n\n---\n**Comentários**\n\n${comments}` : '') +
    extra('Cabeçalho e rodapé das páginas', pages)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
