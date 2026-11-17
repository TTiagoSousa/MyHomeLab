import { open } from 'fs/promises';

const BLOCK = 512;

/** Lê um ficheiro pequeno (ex: manifest.json) de um .tar ustar, ou null se não estiver lá. */
export async function readTarEntry(
  tarPath: string,
  name: string,
  maxBytes = 1024 * 1024,
): Promise<Buffer | null> {
  const file = await open(tarPath, 'r');
  try {
    const header = Buffer.alloc(BLOCK);
    let offset = 0;
    for (;;) {
      const { bytesRead } = await file.read(header, 0, BLOCK, offset);
      if (bytesRead < BLOCK || header.every((byte) => byte === 0)) return null;
      const field = (start: number, length: number) =>
        header.toString('utf8', start, start + length).replace(/\0.*$/s, '');
      const prefix = field(345, 155);
      const entryName = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
      const size = parseInt(field(124, 12).trim() || '0', 8);
      if (entryName === name) {
        if (size > maxBytes) return null;
        const content = Buffer.alloc(size);
        await file.read(content, 0, size, offset + BLOCK);
        return content;
      }
      offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    }
  } finally {
    await file.close();
  }
}
