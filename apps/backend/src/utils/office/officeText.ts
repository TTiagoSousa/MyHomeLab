import { inflateRawSync } from 'zlib';

/**
 * O texto de um Word (.docx) ou de um Excel (.xlsx). Os dois são um zip de XML:
 * lê-se o diretório do zip, tiram-se os ficheiros que interessam e o texto sai
 * das etiquetas. Sem formatação; chega para o assistente ler e resumir.
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Os ficheiros de dentro do zip (nome → conteúdo), só os que `wanted` aceitar. */
function unzip(data: Buffer, wanted: (name: string) => boolean) {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (data.readUInt32LE(i) === EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('não é um ficheiro zip');
  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(offset) !== CENTRAL) break;
    const method = data.readUInt16LE(offset + 10);
    const size = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const local = data.readUInt32LE(offset + 42);
    const name = data.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name) || data.readUInt32LE(local) !== LOCAL) continue;
    const start =
      local +
      30 +
      data.readUInt16LE(local + 26) +
      data.readUInt16LE(local + 28);
    const raw = data.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
  }
  return files;
}

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&amp;/g, '&');

export function docxText(data: Buffer): string {
  const files = unzip(data, (name) =>
    /^word\/(document|header\d*|footer\d*|footnotes)\.xml$/.test(name),
  );
  const order = [...files.keys()].sort((a, b) =>
    a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : 0,
  );
  return order
    .map((name) =>
      decodeXml(
        files
          .get(name)!
          .toString('utf8')
          .replace(/<w:tab\/>/g, '\t')
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<\/w:tc>/g, ' | ')
          .replace(/<[^>]+>/g, ''),
      ),
    )
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function xlsxText(data: Buffer): string {
  const files = unzip(data, (name) =>
    /^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(
      name,
    ),
  );
  const shared = [
    ...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
  ].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((text) => text[1])
        .join(''),
    ),
  );
  const names = [
    ...(files.get('xl/workbook.xml')?.toString('utf8') ?? '').matchAll(
      /<sheet [^>]*name="([^"]+)"/g,
    ),
  ].map((match) => decodeXml(match[1]));
  const sheets = [...files.keys()]
    .filter((name) => name.startsWith('xl/worksheets/'))
    .sort(
      (a, b) =>
        Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]),
    );
  return sheets
    .map((name, index) => {
      const xml = files.get(name)!.toString('utf8');
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(
        (row) =>
          [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
            .map((cell) => {
              const value =
                /<v>([\s\S]*?)<\/v>/.exec(cell[2] ?? '')?.[1] ??
                /<t[^>]*>([\s\S]*?)<\/t>/.exec(cell[2] ?? '')?.[1] ??
                '';
              return /t="s"/.test(cell[1])
                ? (shared.at(Number(value)) ?? '')
                : decodeXml(value);
            })
            .join(' | '),
      );
      return `## ${names.at(index) ?? `Folha ${index + 1}`}\n${rows.filter((row) => row.replace(/[ |]/g, '')).join('\n')}`;
    })
    .join('\n\n')
    .trim();
}
