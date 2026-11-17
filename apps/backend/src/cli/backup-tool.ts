import { copyFile, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractBackup,
  importBackup,
  readBackupManifest,
} from '../backup/helpers/instanceImport';
import { KEYS_FILE } from '../backup/helpers/instanceBackup';

/**
 * Ferramenta do deploy/proxmox/restore.sh e do myhomelab-restore (sem o Nest):
 *
 *   node dist/src/cli/backup-tool.js check <backup.zip>
 *       (confirma a password e mostra de quando é o backup)
 *   node dist/src/cli/backup-tool.js import <backup.zip> <chaves.env>
 *       (repõe os dados no DATABASE_URL e copia as chaves do backup para <chaves.env>)
 *   node dist/src/cli/backup-tool.js merge-env <chaves.env> <myhomelab.env>
 *       (troca ou acrescenta no .env as chaves que vêm no backup)
 *
 * A password do .zip vem em MYHOMELAB_BACKUP_PASSWORD.
 */
const KEY_LINE = /^([A-Z][A-Z0-9_]*)=(.*)$/;

async function mergeEnv(secretsPath: string, envPath: string) {
  const secrets = new Map<string, string>();
  for (const line of (await readFile(secretsPath, 'utf8')).split('\n')) {
    const match = KEY_LINE.exec(line.trim());
    if (match) secrets.set(match[1], match[2]);
  }
  const lines = (await readFile(envPath, 'utf8')).split('\n');
  const seen = new Set<string>();
  const merged = lines.map((line) => {
    const match = KEY_LINE.exec(line.trim());
    if (!match || !secrets.has(match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${secrets.get(match[1])}`;
  });
  while (merged.length && merged[merged.length - 1] === '') merged.pop();
  for (const [key, value] of secrets) {
    if (!seen.has(key)) merged.push(`${key}=${value}`);
  }
  await writeFile(envPath, merged.join('\n') + '\n');
  console.log(`Keys restored: ${[...secrets.keys()].join(', ') || 'none'}`);
}

const password = () => {
  const value = process.env.MYHOMELAB_BACKUP_PASSWORD;
  if (!value) throw new Error('MYHOMELAB_BACKUP_PASSWORD is not set.');
  return value;
};

async function importZip(zipPath: string, keysOut: string) {
  const work = await mkdtemp(join(tmpdir(), 'myhomelab-restore-'));
  try {
    console.log('Extracting the backup…');
    await extractBackup(zipPath, password(), work);
    console.log('Loading the data…');
    const manifest = await importBackup(work, (line) =>
      console.log(`  ${line}`),
    );
    await copyFile(join(work, KEYS_FILE), keysOut);
    console.log(`Restored the backup from ${manifest.createdAt}.`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function main() {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'check' && first) {
    const manifest = await readBackupManifest(first, password());
    console.log(
      `Backup from ${manifest.createdAt}${manifest.version ? ` (${manifest.version})` : ''}`,
    );
    return;
  }
  if (command === 'import' && first && second) {
    await importZip(first, second);
    return;
  }
  if (command === 'merge-env' && first && second) {
    await mergeEnv(first, second);
    return;
  }
  console.error(
    'Usage: backup-tool check <backup.zip> | import <backup.zip> <keys.env> | merge-env <keys.env> <env file>',
  );
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
