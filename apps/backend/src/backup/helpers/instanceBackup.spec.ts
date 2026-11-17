import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BackupFormatError,
  BackupPasswordError,
  decryptBackup,
  encryptBackup,
} from './backupCipher';
import { postgresConnection } from './instanceBackup';
import { createLocalFiles } from './localFiles';
import { readTarEntry } from './readTarEntry';
import { writeTar } from './writeTar';

describe('backup do MyHomeLab', () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'mhl-spec-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  const makeTar = async () => {
    const tarPath = join(folder, 'in.tar');
    await writeTar(tarPath, [
      {
        name: 'manifest.json',
        content: Buffer.from('{"app":"myhomelab","format":1}'),
      },
      {
        name: 'database.sql',
        content: Buffer.from('SELECT 1;\n'.repeat(1000)),
      },
    ]);
    return tarPath;
  };

  it('cifra e decifra o .tar com a password', async () => {
    const tarPath = await makeTar();
    const encrypted = join(folder, 'b.mhlbackup');
    await encryptBackup(tarPath, encrypted, 'uma password longa');
    const out = join(folder, 'out.tar');
    await decryptBackup(encrypted, out, 'uma password longa');
    expect(await readFile(out)).toEqual(await readFile(tarPath));
    expect((await readTarEntry(out, 'manifest.json'))?.toString()).toContain(
      'myhomelab',
    );
    expect(await readTarEntry(out, 'secrets.env')).toBeNull();
  });

  it('recusa a password errada e ficheiros que não são backups', async () => {
    const tarPath = await makeTar();
    const encrypted = join(folder, 'b.mhlbackup');
    await encryptBackup(tarPath, encrypted, 'certa-certa-certa');
    await expect(
      decryptBackup(encrypted, join(folder, 'x.tar'), 'errada-errada'),
    ).rejects.toBeInstanceOf(BackupPasswordError);
    const other = join(folder, 'other.bin');
    await writeFile(other, Buffer.alloc(200, 1));
    await expect(
      decryptBackup(other, join(folder, 'y.tar'), 'certa-certa-certa'),
    ).rejects.toBeInstanceOf(BackupFormatError);
  });

  it('tira a password e os parâmetros do Prisma do DATABASE_URL', () => {
    expect(
      postgresConnection(
        'postgresql://app:p%40ss@127.0.0.1:5432/db?schema=public',
      ),
    ).toEqual({
      url: 'postgresql://app@127.0.0.1:5432/db',
      password: 'p@ss',
    });
  });

  it('o destino local grava, lista, apaga e não sai da pasta', async () => {
    const files = createLocalFiles(folder);
    await files.ensureFolder('local', 'MyHomeLab');
    await files.upload('local', 'MyHomeLab/a.mhlbackup', Buffer.from('x'));
    expect(await files.list('local', 'MyHomeLab')).toEqual([
      { name: 'a.mhlbackup', sizeBytes: 1 },
    ]);
    await files.remove('local', 'MyHomeLab/a.mhlbackup');
    expect(await files.list('local', 'MyHomeLab')).toEqual([]);
    await expect(files.ensureFolder('local', '../fora')).rejects.toThrow();
  });
});
