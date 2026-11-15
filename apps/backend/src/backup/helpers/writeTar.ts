import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export interface TarEntry {
  /** O caminho dentro do arquivo, ex: "utilizador/myHomeLab.bundle". */
  name: string;
  /** O conteúdo, ou o ficheiro em disco de onde vem. */
  content: Buffer | { file: string };
}

const BLOCK = 512;

const octal = (value: number, length: number) =>
  value.toString(8).padStart(length - 1, '0') + '\0';

/** O cabeçalho ustar de um ficheiro; nomes longos dividem-se em prefixo e nome. */
function header(name: string, size: number, mtime: Date): Buffer {
  const block = Buffer.alloc(BLOCK, 0);
  let base = name;
  let prefix = '';
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf('/', 155);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  block.write(base, 0, 100, 'utf8');
  block.write(octal(0o644, 8), 100, 'ascii');
  block.write(octal(0, 8), 108, 'ascii');
  block.write(octal(0, 8), 116, 'ascii');
  block.write(octal(size, 12), 124, 'ascii');
  block.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 'ascii');
  block.fill(' ', 148, 156);
  block.write('0', 156, 'ascii');
  block.write('ustar\0', 257, 'ascii');
  block.write('00', 263, 'ascii');
  block.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return block;
}

async function* tarStream(entries: TarEntry[], mtime: Date) {
  for (const entry of entries) {
    const size = Buffer.isBuffer(entry.content)
      ? entry.content.length
      : (await stat(entry.content.file)).size;
    yield header(entry.name, size, mtime);
    if (Buffer.isBuffer(entry.content)) {
      yield entry.content;
    } else {
      for await (const chunk of createReadStream(entry.content.file)) {
        yield chunk as Buffer;
      }
    }
    const padding = (BLOCK - (size % BLOCK)) % BLOCK;
    if (padding) yield Buffer.alloc(padding, 0);
  }
  yield Buffer.alloc(BLOCK * 2, 0);
}

/**
 * Junta os ficheiros num .tar (ustar, sem compressão) gravado em disco. Os
 * ficheiros grandes (os bundles) passam de disco para disco, sem ir à memória.
 */
export async function writeTar(
  path: string,
  entries: TarEntry[],
): Promise<number> {
  await pipeline(
    Readable.from(tarStream(entries, new Date())),
    createWriteStream(path),
  );
  return (await stat(path)).size;
}
