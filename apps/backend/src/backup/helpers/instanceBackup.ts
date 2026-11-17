import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { encryptBackup } from './backupCipher';
import { BackupFile } from './backupSources';
import { writeTar } from './writeTar';

/**
 * O backup do próprio MyHomeLab: a base de dados inteira (docs e as ligações entre
 * eles, agentes, tarefas, serviços, apps ligadas com os logins cifrados, …) e as
 * chaves sem as quais esses logins não se leem. Fica num .mhlbackup cifrado com a
 * password dos backups (backupCipher.ts).
 *
 * Dentro do .tar: manifest.json, database.sql (pg_dump) e secrets.env.
 */

/** As variáveis do .env que vão no backup. O resto (porta, endereço, base de dados) é da instalação. */
export const INSTANCE_SECRET_KEYS = [
  'TOKEN_ENCRYPTION_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

export const INSTANCE_BACKUP_FORMAT = 1;

export interface InstanceBackupManifest {
  format: number;
  app: 'myhomelab';
  createdAt: string;
  /** A release instalada (vX.Y.Z) ou aquela em que o código assenta. */
  version: string | null;
  /** A última migração aplicada: repor só numa instalação que a conheça. */
  migration: string | null;
  secrets: string[];
}

const PG_DUMP_TIMEOUT_MS = 15 * 60_000;

/** O DATABASE_URL do Prisma para o pg_dump/psql: sem os parâmetros do Prisma e sem a password no URL. */
export function postgresConnection(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const password = decodeURIComponent(url.password);
  url.password = '';
  url.search = '';
  return { url: url.toString(), password };
}

function runPgDump(sqlPath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não está definida.');
  const { url, password } = postgresConnection(databaseUrl);

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PG_DUMP_PATH || 'pg_dump',
      [
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
        '--file',
        sqlPath,
        '--dbname',
        url,
      ],
      { env: { ...process.env, PGPASSWORD: password } },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), PG_DUMP_TIMEOUT_MS);
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new Error(
          error.code === 'ENOENT'
            ? 'O pg_dump não está instalado neste servidor (ou define PG_DUMP_PATH).'
            : `O pg_dump falhou: ${error.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(`O pg_dump falhou: ${stderr.trim() || `código ${code}`}`),
        );
    });
  });
}

const envLine = (key: string, value: string) =>
  `${key}=${JSON.stringify(value)}`;

/** As migrações que este código conhece (prisma/migrations). */
export async function knownMigrations(): Promise<string[]> {
  try {
    const entries = await readdir(join(process.cwd(), 'prisma', 'migrations'), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function createInstanceBackup(input: {
  password: string;
  version: string | null;
  migration: string | null;
}): Promise<BackupFile> {
  const folder = await mkdtemp(join(tmpdir(), 'myhomelab-backup-'));
  const cleanup = () => rm(folder, { recursive: true, force: true });
  try {
    const sqlPath = join(folder, 'database.sql');
    await runPgDump(sqlPath);

    const secrets = INSTANCE_SECRET_KEYS.filter((key) => process.env[key]);
    const manifest: InstanceBackupManifest = {
      format: INSTANCE_BACKUP_FORMAT,
      app: 'myhomelab',
      createdAt: new Date().toISOString(),
      version: input.version,
      migration: input.migration,
      secrets: [...secrets],
    };
    const tarPath = join(folder, 'backup.tar');
    await writeTar(tarPath, [
      {
        name: 'manifest.json',
        content: Buffer.from(JSON.stringify(manifest, null, 2)),
      },
      { name: 'database.sql', content: { file: sqlPath } },
      {
        name: 'secrets.env',
        content: Buffer.from(
          secrets.map((key) => envLine(key, process.env[key]!)).join('\n') +
            '\n',
        ),
      },
    ]);
    await rm(sqlPath, { force: true });

    const outPath = join(folder, 'backup.mhlbackup');
    const sizeBytes = await encryptBackup(tarPath, outPath, input.password);
    await rm(tarPath, { force: true });
    return {
      content: createReadStream(outPath),
      sizeBytes,
      missing: [],
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
