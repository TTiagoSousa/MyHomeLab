import { createWriteStream } from 'fs';
import {
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  writeFile,
} from 'fs/promises';
import { homedir } from 'os';
import { join, resolve, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { NextcloudAccount, NextcloudFile } from './nextcloudFiles';

/** A pasta dos destinos "Neste servidor": BACKUP_LOCAL_DIR, ou ~/myhomelab-backups. */
export const localBackupRoot = () =>
  resolve(process.env.BACKUP_LOCAL_DIR || join(homedir(), 'myhomelab-backups'));

/**
 * Os ficheiros de um destino numa pasta do próprio servidor, com a mesma forma dos
 * do Nextcloud (nextcloudFiles.ts) para o BackupService não ver a diferença.
 */
export function createLocalFiles(root = localBackupRoot()) {
  const inside = (path: string) => {
    const full = resolve(root, path);
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error('Caminho fora da pasta dos backups.');
    }
    return full;
  };

  async function account(): Promise<NextcloudAccount> {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const info = await statfs(root).catch(() => null);
    return {
      userId: 'local',
      displayName: root,
      freeBytes: info ? info.bavail * info.bsize : null,
    };
  }

  async function ensureFolder(_userId: string, path: string) {
    await mkdir(inside(path), { recursive: true, mode: 0o700 });
  }

  async function upload(
    _userId: string,
    path: string,
    content: Buffer | Readable,
  ) {
    const target = inside(path);
    const partial = `${target}.part`;
    if (Buffer.isBuffer(content)) {
      await writeFile(partial, content, { mode: 0o600 });
    } else {
      await pipeline(content, createWriteStream(partial, { mode: 0o600 }));
    }
    await rename(partial, target);
  }

  async function list(
    _userId: string,
    folder: string,
  ): Promise<NextcloudFile[]> {
    const dir = inside(folder);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: NextcloudFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith('.part')) continue;
      const info = await stat(join(dir, entry.name)).catch(() => null);
      files.push({ name: entry.name, sizeBytes: info?.size ?? null });
    }
    return files;
  }

  async function remove(_userId: string, path: string) {
    await rm(inside(path), { force: true });
  }

  return { account, ensureFolder, upload, list, remove };
}
