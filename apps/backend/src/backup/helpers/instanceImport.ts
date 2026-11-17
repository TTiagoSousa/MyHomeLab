import { createReadStream, createWriteStream, openAsBlob } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { createInterface } from 'readline';
import { Writable } from 'stream';
import {
  BlobReader,
  configure,
  TextWriter,
  ZipReader,
  type Entry,
} from '@zip.js/zip.js';
import {
  connectDatabase,
  INSTANCE_BACKUP_FORMAT,
  InstanceBackupManifest,
  KEYS_FILE,
  listTables,
  MANIFEST_FILE,
  quoteIdent,
  tableColumns,
} from './instanceBackup';

configure({ useWebWorkers: false });

/**
 * Ler e repor um backup do MyHomeLab (o .zip de instanceBackup.ts). Usado pelo backend
 * (validar antes de pedir a reposição) e pelo src/cli/backup-tool.ts, que o
 * deploy/proxmox/restore.sh corre com o backend parado.
 */

export class BackupPasswordError extends Error {
  constructor() {
    super('A password não abre este backup.');
  }
}

export class BackupFormatError extends Error {
  constructor(message = 'Este ficheiro não é um backup do MyHomeLab (.zip).') {
    super(message);
  }
}

const INSERT_ROWS = 200;

async function openZip(zipPath: string, password: string) {
  let reader: ZipReader<unknown>;
  let entries: Entry[];
  try {
    reader = new ZipReader(new BlobReader(await openAsBlob(zipPath)), {
      password,
    });
    entries = await reader.getEntries();
  } catch {
    throw new BackupFormatError();
  }
  return { reader, entries };
}

const isPasswordError = (error: unknown) =>
  error instanceof Error && /password/i.test(error.message);

async function readText(entry: Entry): Promise<string> {
  if (entry.directory) throw new BackupFormatError();
  try {
    return await entry.getData(new TextWriter());
  } catch (error) {
    if (isPasswordError(error)) throw new BackupPasswordError();
    throw error;
  }
}

/** Abre o .zip com a password e lê o manifest.json (falha com a password errada). */
export async function readBackupManifest(
  zipPath: string,
  password: string,
): Promise<InstanceBackupManifest> {
  const { reader, entries } = await openZip(zipPath, password);
  try {
    const entry = entries.find((item) => item.filename === MANIFEST_FILE);
    if (!entry) throw new BackupFormatError();
    let manifest: InstanceBackupManifest;
    try {
      manifest = JSON.parse(await readText(entry)) as InstanceBackupManifest;
    } catch (error) {
      if (error instanceof BackupPasswordError) throw error;
      throw new BackupFormatError();
    }
    if (manifest.app !== 'myhomelab' || !Array.isArray(manifest.tables)) {
      throw new BackupFormatError();
    }
    if (manifest.format > INSTANCE_BACKUP_FORMAT) {
      throw new BackupFormatError(
        'Este backup foi feito por uma versão mais recente do MyHomeLab. Atualiza primeiro.',
      );
    }
    if (!entries.some((item) => item.filename === KEYS_FILE)) {
      throw new BackupFormatError(
        'Este backup está incompleto (faltam as chaves).',
      );
    }
    return manifest;
  } finally {
    await reader.close();
  }
}

/** Extrai o .zip para `folder` (só caminhos dentro dela). */
export async function extractBackup(
  zipPath: string,
  password: string,
  folder: string,
) {
  const root = resolve(folder);
  const { reader, entries } = await openZip(zipPath, password);
  try {
    for (const entry of entries) {
      if (entry.directory) continue;
      const target = resolve(root, entry.filename);
      if (!target.startsWith(root + sep)) throw new BackupFormatError();
      await mkdir(dirname(target), { recursive: true });
      const out = createWriteStream(target, { mode: 0o600 });
      try {
        await entry.getData(Writable.toWeb(out));
      } catch (error) {
        if (isPasswordError(error)) throw new BackupPasswordError();
        throw error;
      }
    }
  } finally {
    await reader.close();
  }
}

async function* lines(path: string) {
  const input = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  for await (const line of input) {
    if (line.trim()) yield line;
  }
}

/**
 * Substitui todos os dados pelos do backup extraído em `folder`, numa só transação: as
 * chaves estrangeiras passam a "deferrable" enquanto se carrega (a ordem das tabelas e as
 * árvores — documentos, tarefas — deixam de importar) e voltam ao que eram no fim. Colunas
 * que já não existem ficam de fora; colunas novas ficam com o valor por omissão.
 */
export async function importBackup(
  folder: string,
  log: (message: string) => void = () => undefined,
  databaseUrl = process.env.DATABASE_URL,
) {
  const manifest = JSON.parse(
    await readFile(join(folder, MANIFEST_FILE), 'utf8'),
  ) as InstanceBackupManifest;
  const client = await connectDatabase(databaseUrl);
  const deferred: { table: string; name: string }[] = [];
  try {
    const current = await listTables(client);
    const foreignKeys = await client.query<{ table: string; name: string }>(
      `SELECT c.conrelid::regclass::text AS table, c.conname AS name FROM pg_constraint c
       WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND NOT c.condeferrable`,
    );
    for (const key of foreignKeys.rows) {
      await client.query(
        `ALTER TABLE ${key.table} ALTER CONSTRAINT ${quoteIdent(key.name)} DEFERRABLE INITIALLY IMMEDIATE`,
      );
      deferred.push(key);
    }

    await client.query('BEGIN');
    try {
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      if (current.length) {
        await client.query(`TRUNCATE ${current.map(quoteIdent).join(', ')}`);
      }
      for (const entry of manifest.tables) {
        if (!current.includes(entry.table)) {
          log(`skip ${entry.table} (no longer exists)`);
          continue;
        }
        const existing = await tableColumns(client, entry.table);
        const columns = entry.columns
          .filter((column) => existing.includes(column))
          .map(quoteIdent)
          .join(', ');
        const sql = `INSERT INTO ${quoteIdent(entry.table)} (${columns}) SELECT ${columns} FROM json_populate_recordset(NULL::${quoteIdent(entry.table)}, $1::json)`;
        let batch: string[] = [];
        let rows = 0;
        const flush = async () => {
          if (!batch.length) return;
          await client.query(sql, [`[${batch.join(',')}]`]);
          rows += batch.length;
          batch = [];
        };
        for await (const line of lines(join(folder, entry.file))) {
          batch.push(line);
          if (batch.length >= INSERT_ROWS) await flush();
        }
        await flush();
        log(`${entry.table}: ${rows}`);
      }

      // As sequências (colunas autoincrement) a seguir ao maior valor reposto.
      const sequences = await client.query<{
        sequence: string;
        table: string;
        column: string;
      }>(
        `SELECT s.oid::regclass::text AS sequence, t.oid::regclass::text AS table, a.attname AS column
         FROM pg_class s
         JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a', 'i')
         JOIN pg_class t ON t.oid = d.refobjid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
         WHERE s.relkind = 'S' AND t.relnamespace = 'public'::regnamespace`,
      );
      for (const seq of sequences.rows) {
        await client.query(
          `SELECT setval($1::regclass, COALESCE((SELECT max(${quoteIdent(seq.column)}) FROM ${seq.table}), 0) + 1, false)`,
          [seq.sequence],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    for (const key of deferred) {
      await client
        .query(
          `ALTER TABLE ${key.table} ALTER CONSTRAINT ${quoteIdent(key.name)} NOT DEFERRABLE`,
        )
        .catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
  return manifest;
}
