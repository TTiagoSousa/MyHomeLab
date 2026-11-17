import { readFile, writeFile } from 'fs/promises';
import { decryptBackup } from '../backup/helpers/backupCipher';

/**
 * Ferramenta do deploy/proxmox/restore.sh e do myhomelab-restore (sem o Nest):
 *
 *   node dist/src/cli/backup-tool.js decrypt <ficheiro.mhlbackup> <saída.tar>
 *       (a password vem em MYHOMELAB_BACKUP_PASSWORD)
 *   node dist/src/cli/backup-tool.js merge-env <secrets.env> <myhomelab.env>
 *       (troca ou acrescenta no .env as chaves que vêm no backup)
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

async function main() {
  const [command, input, output] = process.argv.slice(2);
  if (command === 'decrypt' && input && output) {
    const password = process.env.MYHOMELAB_BACKUP_PASSWORD;
    if (!password) throw new Error('MYHOMELAB_BACKUP_PASSWORD is not set.');
    await decryptBackup(input, output, password);
    return;
  }
  if (command === 'merge-env' && input && output) {
    await mergeEnv(input, output);
    return;
  }
  console.error(
    'Usage: backup-tool decrypt <in.mhlbackup> <out.tar> | merge-env <secrets.env> <env file>',
  );
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
