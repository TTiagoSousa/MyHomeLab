import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { parsePostgresUrl } from 'src/postgres/postgres.client';
import { BackupFile } from './backupSources';

const TIMEOUT_MS = 2 * 60 * 60_000;

/**
 * O backup do PostgreSQL: o pg_dump (o do próprio CT do MyHomeLab, que já tem o PostgreSQL
 * instalado) da base de dados da ligação, em SQL simples com gzip (.sql.gz), para um ficheiro
 * temporário que se apaga depois de enviado. A password vai em PGPASSWORD (nunca na linha de
 * comandos). Só essa base: os papéis e as outras bases não entram (seria o pg_dumpall).
 * O pg_dump não consegue copiar um servidor de versão maior do que a dele — nesse caso diz-se.
 */
export async function postgresBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.username || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O PostgreSQL já não tem password. Liga-o outra vez em Apps ligadas.',
    );
  }
  const location = parsePostgresUrl(account.baseUrl);
  const work = await mkdtemp(join(tmpdir(), 'myhomelab-postgres-'));
  const cleanup = () => rm(work, { recursive: true, force: true });
  const file = join(work, 'dump.sql.gz');
  try {
    const child = spawn(
      'pg_dump',
      [
        '--no-password',
        '--format=plain',
        `--host=${location.host}`,
        `--port=${location.port}`,
        `--username=${account.username}`,
        `--dbname=${location.database}`,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: account.accessToken,
          // O libpq só verifica o certificado com a raiz configurada: "require" cifra sempre.
          PGSSLMODE: location.ssl === 'off' ? 'disable' : 'require',
          PGAPPNAME: 'MyHomeLab backup',
          PGCONNECT_TIMEOUT: '15',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => {
      if (errors.length < 4000) errors += chunk.toString();
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    exited.catch(() => undefined);
    try {
      await pipeline(child.stdout, createGzip(), createWriteStream(file));
      const code = await exited;
      if (code !== 0)
        throw new Error(errors.trim() || `pg_dump saiu com ${code}`);
    } catch (error) {
      if (child.exitCode === null) child.kill('SIGTERM');
      throw error;
    } finally {
      clearTimeout(timer);
    }
    return {
      content: createReadStream(file),
      sizeBytes: (await stat(file)).size,
      missing: [],
      cleanup,
    };
  } catch (error) {
    await cleanup();
    const text = error instanceof Error ? error.message : String(error);
    if ((error as { code?: string }).code === 'ENOENT') {
      throw new AppIntegrationError(
        'APP_NOT_SUPPORTED',
        'Não há pg_dump no servidor do MyHomeLab. Instala o cliente do PostgreSQL (apt install postgresql-client).',
      );
    }
    if (/server version mismatch/i.test(text)) {
      throw new AppIntegrationError(
        'APP_NOT_SUPPORTED',
        `O pg_dump do MyHomeLab é mais antigo do que o servidor PostgreSQL: instala no CT o postgresql-client da versão do servidor (repositório PGDG). ${text}`,
      );
    }
    if (/password authentication failed|no password supplied/i.test(text)) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        `O PostgreSQL recusou a password no backup: ${text}`,
      );
    }
    if (
      /could not connect|could not translate host|timeout expired/i.test(text)
    ) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `O pg_dump não chegou ao PostgreSQL: ${text}`,
      );
    }
    throw new Error(`O pg_dump falhou: ${text}`);
  }
}
