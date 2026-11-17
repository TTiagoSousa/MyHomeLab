import { once } from 'events';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, relative, sep } from 'path';
import { Readable, Writable } from 'stream';
import { Client } from 'pg';
import { configure, ZipWriter } from '@zip.js/zip.js';
import { BackupFile } from './backupSources';
import { AREA_DESCRIPTIONS, tableFile } from './instanceAreas';

/**
 * O backup do próprio MyHomeLab: um .zip com password (AES-256) que abre como uma pasta
 * com uma subpasta por área (agentes/, documentos/, projetos/, apps-ligadas/, ia/, …).
 * Cada tabela da base de dados vai inteira num .jsonl (uma linha por registo); os
 * documentos e os prompts dos agentes vão também em Markdown, para ler. Em _restauro/
 * ficam as chaves (TOKEN_ENCRYPTION_KEY, …) sem as quais os logins guardados não se leem.
 * Repor lê os mesmos .jsonl (instanceImport.ts) — não precisa do pg_dump.
 */

configure({ useWebWorkers: false });

/** As variáveis do .env que vão no backup. O resto (porta, endereço, base de dados) é da instalação. */
export const INSTANCE_SECRET_KEYS = [
  'TOKEN_ENCRYPTION_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

export const INSTANCE_BACKUP_FORMAT = 2;
export const MANIFEST_FILE = 'manifest.json';
export const KEYS_FILE = '_restauro/chaves.env';

export interface InstanceBackupTable {
  table: string;
  file: string;
  rows: number;
  columns: string[];
}

export interface InstanceBackupManifest {
  format: number;
  app: 'myhomelab';
  createdAt: string;
  /** A release instalada (vX.Y.Z) ou aquela em que o código assenta. */
  version: string | null;
  /** A última migração aplicada: repor só numa instalação que a conheça. */
  migration: string | null;
  secrets: string[];
  tables: InstanceBackupTable[];
}

/** Uma falha ao criar o backup que se explica a quem o pediu (a mensagem vai para a app). */
export class InstanceBackupError extends Error {
  constructor(
    message: string,
    /** true quando falta algo no servidor, não um erro a meio. */
    readonly unavailable = false,
  ) {
    super(message);
  }
}

const FETCH_ROWS = 500;

export async function connectDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new InstanceBackupError('DATABASE_URL não está definida.', true);
  }
  // O mesmo endereço que o Prisma usa (src/prisma/prisma.service.ts).
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function listTables(client: Client): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

export async function tableColumns(
  client: Client,
  table: string,
): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

/** Grava a tabela inteira em .jsonl, aos bocados (um cursor), sem a pôr toda em memória. */
async function exportTable(client: Client, table: string, path: string) {
  await mkdir(dirname(path), { recursive: true });
  const out = createWriteStream(path);
  let rows = 0;
  await client.query(
    `DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS row FROM ${quoteIdent(table)} t`,
  );
  try {
    for (;;) {
      const batch = await client.query<{ row: string }>(
        `FETCH ${FETCH_ROWS} FROM backup_rows`,
      );
      if (!batch.rows.length) break;
      for (const { row } of batch.rows) {
        if (!out.write(`${row}\n`)) await once(out, 'drain');
      }
      rows += batch.rows.length;
    }
  } finally {
    await client.query('CLOSE backup_rows');
    out.end();
    await once(out, 'close');
  }
  return rows;
}

const safeName = (name: string) =>
  name
    .replace(/\p{Cc}+/gu, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'sem-nome';

/** Os documentos em Markdown, nas pastas das secções, e os prompts dos agentes — só para ler. */
async function writeReadableCopies(client: Client, folder: string) {
  const sections = await client.query<{
    id: string;
    name: string;
    parentId: string | null;
  }>('SELECT id, name, "parentId" FROM "DocSection"');
  const byId = new Map(sections.rows.map((section) => [section.id, section]));
  const sectionPath = (id: string | null): string[] => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let current = id ? byId.get(id) : undefined;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(safeName(current.name));
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts;
  };

  const docs = await client.query<{
    id: string;
    title: string;
    content: string;
    sectionId: string | null;
  }>('SELECT id, title, content, "sectionId" FROM "Doc" ORDER BY title');
  const used = new Set<string>();
  for (const doc of docs.rows) {
    const base = join(
      folder,
      'documentos',
      'leitura',
      ...sectionPath(doc.sectionId),
    );
    let file = join(base, `${safeName(doc.title)}.md`);
    if (used.has(file))
      file = join(base, `${safeName(doc.title)} (${doc.id.slice(0, 8)}).md`);
    used.add(file);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `# ${doc.title}\n\n${doc.content}\n`);
  }

  const agents = await client.query<{
    key: string;
    name: string;
    description: string;
    prompt: string | null;
  }>('SELECT key, name, description, prompt FROM "Agent" ORDER BY name');
  for (const agent of agents.rows) {
    const file = join(folder, 'agentes', `${safeName(agent.key)}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(
      file,
      `# ${agent.name}\n\n${agent.description}\n\n## Prompt\n\n${agent.prompt ?? '(o prompt de origem)'}\n`,
    );
  }
}

const envLine = (key: string, value: string) =>
  `${key}=${JSON.stringify(value)}`;

function readme(manifest: InstanceBackupManifest) {
  const areas = [
    ...new Set(manifest.tables.map((table) => table.file.split('/')[0])),
  ].sort();
  return [
    `Backup do MyHomeLab — ${manifest.createdAt}${manifest.version ? ` (${manifest.version})` : ''}`,
    '',
    'Cada pasta é uma área. Os .jsonl têm uma linha por registo (JSON) e são o que se repõe;',
    'os .md são cópias para ler.',
    '',
    ...areas.map((area) => `${area}/  — ${AREA_DESCRIPTIONS[area] ?? ''}`),
    '_restauro/  — as chaves que leem os logins guardados (não partilhes este ficheiro)',
    '',
    'Repor: Admin → Backup → Repor um backup, ou no servidor: myhomelab-restore <este .zip>',
    '',
  ].join('\n');
}

async function filesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, {
    withFileTypes: true,
    recursive: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Junta a pasta num .zip com password (AES-256). */
async function zipFolder(folder: string, zipPath: string, password: string) {
  const file = createWriteStream(zipPath, { mode: 0o600 });
  const closed = once(file, 'close');
  const writer = new ZipWriter(Writable.toWeb(file), {
    password,
    encryptionStrength: 3,
  });
  const files = (await filesIn(folder)).sort();
  for (const path of files) {
    const name = relative(folder, path).split(sep).join('/');
    await writer.add(
      name,
      Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
    );
  }
  await writer.close();
  await closed;
  return (await stat(zipPath)).size;
}

export async function createInstanceBackup(input: {
  password: string;
  version: string | null;
  migration: string | null;
}): Promise<BackupFile> {
  const work = await mkdtemp(join(tmpdir(), 'myhomelab-backup-'));
  const cleanup = () => rm(work, { recursive: true, force: true });
  try {
    const folder = join(work, 'myhomelab');
    const tables: InstanceBackupTable[] = [];
    const client = await connectDatabase();
    try {
      // Tudo do mesmo instante, mesmo com a app a escrever entretanto.
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      for (const table of await listTables(client)) {
        const file = tableFile(table);
        const rows = await exportTable(client, table, join(folder, file));
        tables.push({
          table,
          file,
          rows,
          columns: await tableColumns(client, table),
        });
      }
      await writeReadableCopies(client, folder);
      await client.query('COMMIT');
    } finally {
      await client.end().catch(() => undefined);
    }

    const secrets = INSTANCE_SECRET_KEYS.filter((key) => process.env[key]);
    const manifest: InstanceBackupManifest = {
      format: INSTANCE_BACKUP_FORMAT,
      app: 'myhomelab',
      createdAt: new Date().toISOString(),
      version: input.version,
      migration: input.migration,
      secrets: [...secrets],
      tables,
    };
    await writeFile(
      join(folder, MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
    );
    await writeFile(join(folder, 'LEIA-ME.txt'), readme(manifest));
    await mkdir(join(folder, '_restauro'), { recursive: true });
    await writeFile(
      join(folder, KEYS_FILE),
      secrets.map((key) => envLine(key, process.env[key]!)).join('\n') + '\n',
      { mode: 0o600 },
    );

    const zipPath = join(work, 'backup.zip');
    const sizeBytes = await zipFolder(folder, zipPath, input.password);
    await rm(folder, { recursive: true, force: true });
    return {
      content: createReadStream(zipPath),
      sizeBytes,
      missing: [],
      cleanup,
    };
  } catch (error) {
    await cleanup();
    if (error instanceof InstanceBackupError) throw error;
    throw new InstanceBackupError(
      `Não foi possível criar o backup: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

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
