import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  type ScryptOptions,
} from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { open, stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';

/**
 * O ficheiro de um backup do MyHomeLab (.mhlbackup): o .tar comprimido com gzip e
 * cifrado com AES-256-GCM, com a chave tirada da password por scrypt.
 *
 *   "MHLBACKUP1\n" (11 bytes) · sal (16) · iv (12) · dados cifrados · tag (16)
 *
 * Sem dependências do Nest: o comando myhomelab-restore usa este ficheiro pelo
 * src/cli/backup-tool.ts.
 */
export const BACKUP_MAGIC = Buffer.from('MHLBACKUP1\n', 'ascii');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = BACKUP_MAGIC.length + SALT_BYTES + IV_BYTES;
const SCRYPT: ScryptOptions = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export class BackupPasswordError extends Error {
  constructor() {
    super('A password não abre este backup (ou o ficheiro está estragado).');
  }
}

export class BackupFormatError extends Error {
  constructor() {
    super('Este ficheiro não é um backup do MyHomeLab (.mhlbackup).');
  }
}

const deriveKey = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, SCRYPT, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** Comprime e cifra `tarPath` em `outPath`. Devolve o tamanho final. */
export async function encryptBackup(
  tarPath: string,
  outPath: string,
  password: string,
): Promise<number> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    'aes-256-gcm',
    await deriveKey(password, salt),
    iv,
  );
  const out = createWriteStream(outPath, { mode: 0o600 });
  out.write(Buffer.concat([BACKUP_MAGIC, salt, iv]));
  await pipeline(createReadStream(tarPath), createGzip(), cipher, out, {
    end: false,
  });
  await new Promise<void>((resolve, reject) =>
    out.end(cipher.getAuthTag(), (error?: Error | null) =>
      error ? reject(error) : resolve(),
    ),
  );
  return (await stat(outPath)).size;
}

/** Decifra e descomprime `inPath` para o .tar em `tarPath`. */
export async function decryptBackup(
  inPath: string,
  tarPath: string,
  password: string,
): Promise<void> {
  const { size } = await stat(inPath);
  if (size < HEADER_BYTES + TAG_BYTES) throw new BackupFormatError();

  const file = await open(inPath, 'r');
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await file.read(header, 0, HEADER_BYTES, 0);
    await file.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await file.close();
  }
  if (!header.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new BackupFormatError();
  }
  const salt = header.subarray(
    BACKUP_MAGIC.length,
    BACKUP_MAGIC.length + SALT_BYTES,
  );
  const iv = header.subarray(BACKUP_MAGIC.length + SALT_BYTES);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    await deriveKey(password, salt),
    iv,
  );
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(inPath, {
        start: HEADER_BYTES,
        end: size - TAG_BYTES - 1,
      }),
      decipher,
      createGunzip(),
      createWriteStream(tarPath, { mode: 0o600 }),
    );
  } catch {
    throw new BackupPasswordError();
  }
}
