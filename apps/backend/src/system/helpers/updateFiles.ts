import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Ficheiros partilhados com o atualizador (deploy/proxmox/update.sh), na pasta
 * SYSTEM_UPDATES_DIR. O backend corre sem privilégios e não atualiza nada sozinho:
 * escreve `requests/request` com a versão pedida, e uma unit .path do systemd (root)
 * vê o ficheiro aparecer e corre a atualização. O progresso volta em
 * `state/status.json` e o output em `state/update.log`.
 *
 * Duas pastas: em `requests/` só o backend escreve (o root lê os pedidos como o
 * utilizador da app); `state/` é do root e o backend só a lê. Assim o root nunca
 * escreve numa pasta onde o utilizador da app possa deixar um symlink.
 *
 * Sem SYSTEM_UPDATES_DIR (desenvolvimento) as atualizações estão desligadas.
 */
export function updatesDir(): string | null {
  return process.env.SYSTEM_UPDATES_DIR || null;
}

/** Os pedidos do backend ao root (atualização e reposição de um backup). */
export function requestsDir(dir: string): string {
  return join(dir, 'requests');
}

/** O estado e os registos que o root escreve; o backend só lê. */
export function stateDir(dir: string): string {
  return join(dir, 'state');
}

export type UpdateState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export interface UpdateStatus {
  state: UpdateState;
  target: string | null;
  from: string | null;
  step: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  log: string[];
}

const IDLE: UpdateStatus = {
  state: 'idle',
  target: null,
  from: null,
  step: null,
  message: null,
  startedAt: null,
  finishedAt: null,
  log: [],
};

/** Uma atualização nunca demora isto; "running" mais antigo é uma que foi cortada. */
const STALE_RUNNING_MS = 60 * 60_000;

/**
 * Há uma reposição de um backup pedida ou a correr (o restore.sh usa o mesmo cadeado:
 * um pedido de atualização no meio ficava na fila para sempre).
 */
export async function restoreBusy(): Promise<boolean> {
  const dir = updatesDir();
  if (!dir) return false;
  const pending = await fs
    .stat(join(requestsDir(dir), 'restore-request'))
    .then(() => true)
    .catch(() => false);
  if (pending) return true;
  const raw = await fs
    .readFile(join(stateDir(dir), 'restore-status.json'), 'utf8')
    .catch(() => '');
  return /"state"\s*:\s*"running"/.test(raw);
}

/**
 * O commit da última atualização que acabou bem (o update.sh escreve-o no fim). O HEAD
 * do git não serve: o checkout da versão nova acontece antes do build, e uma atualização
 * cortada a meio deixava-o na versão nova com o código antigo a correr.
 */
export async function readInstalledCommit(): Promise<string | null> {
  const dir = updatesDir();
  if (!dir) return null;
  const raw = await fs
    .readFile(join(stateDir(dir), 'installed-commit'), 'utf8')
    .catch(() => '');
  const commit = raw.trim();
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit : null;
}

// Códigos de cor do terminal que o update.sh escreve no log.
const ESC = String.fromCharCode(27);
const ANSI_COLOURS = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

export async function readUpdateStatus(logLines = 40): Promise<UpdateStatus> {
  const dir = updatesDir();
  if (!dir) return IDLE;

  const pending = await fs
    .readFile(join(requestsDir(dir), 'request'), 'utf8')
    .catch(() => null);
  const raw = await fs
    .readFile(join(stateDir(dir), 'status.json'), 'utf8')
    .catch(() => null);
  let status: UpdateStatus = { ...IDLE };
  if (raw) {
    try {
      status = {
        ...IDLE,
        ...(JSON.parse(raw) as Partial<UpdateStatus>),
        log: [],
      };
    } catch {
      // ficheiro a meio de ser escrito: fica o estado anterior na próxima leitura
    }
  }

  // A correr há mais de 1 hora: o update.sh foi cortado (falta de luz, reinício do CT) e
  // nunca escreveu o fim. Sem isto ficava "em curso" para sempre e não deixava pedir outra.
  if (
    status.state === 'running' &&
    status.startedAt &&
    Date.now() - new Date(status.startedAt).getTime() > STALE_RUNNING_MS
  ) {
    status = {
      ...status,
      state: 'failed',
      message: `A atualização foi interrompida a meio (passo ${status.step ?? '?'}). Podes pedi-la outra vez.`,
    };
  }

  // Pedido escrito mas o atualizador ainda não lhe pegou.
  if (pending && status.state !== 'running') {
    status = { ...IDLE, state: 'queued', target: pending.trim() };
  }

  const log = await fs
    .readFile(join(stateDir(dir), 'update.log'), 'utf8')
    .catch(() => '');
  const lines = log
    .replace(ANSI_COLOURS, '')
    .split('\n')
    .filter((line) => line.trim());
  status.log = logLines > 0 ? lines.slice(-logLines) : [];
  return status;
}

/** Escreve o pedido de forma atómica (o atualizador nunca lê meio ficheiro). */
export async function writeUpdateRequest(version: string): Promise<void> {
  const dir = updatesDir();
  if (!dir) throw new Error('Updates are disabled');
  const tmp = join(requestsDir(dir), `.request-${process.pid}`);
  await fs.writeFile(tmp, `${version}\n`, { mode: 0o644 });
  await fs.rename(tmp, join(requestsDir(dir), 'request'));
}
