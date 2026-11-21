import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { decryptToken, encryptToken } from 'src/utils/crypto/token-cipher';
import { getInstalledVersion } from 'src/system/helpers/getInstalledVersion';
import {
  requestsDir,
  stateDir,
  updatesDir,
} from 'src/system/helpers/updateFiles';
import { BackupFile } from './helpers/backupSources';
import {
  createInstanceBackup,
  InstanceBackupError,
  InstanceBackupManifest,
  knownMigrations,
} from './helpers/instanceBackup';
import {
  BackupFormatError,
  BackupPasswordError,
  readBackupManifest,
} from './helpers/instanceImport';
import { localBackupRoot } from './helpers/localFiles';

export type RestoreState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export interface RestoreStatus {
  state: RestoreState;
  step: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  backupCreatedAt: string | null;
  log: string[];
}

const IDLE: RestoreStatus = {
  state: 'idle',
  step: null,
  message: null,
  startedAt: null,
  finishedAt: null,
  backupCreatedAt: null,
  log: [],
};

const ESC = String.fromCharCode(27);
const ANSI_COLOURS = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

/**
 * O backup do próprio MyHomeLab: a password que o cifra, o ficheiro (para os
 * backups automáticos e para descarregar no Admin) e a reposição. Repor troca a
 * base de dados inteira, por isso não corre no backend: ele decifra e valida o
 * ficheiro, deixa-o em SYSTEM_UPDATES_DIR/requests/restore e escreve
 * `requests/restore-request`;
 * uma unit .path do systemd (root) corre o deploy/proxmox/restore.sh.
 */
@Injectable()
export class InstanceBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async settings() {
    const setting = await this.prisma.instanceBackupSetting.findUnique({
      where: { id: 'default' },
      select: { updatedAt: true },
    });
    return {
      passwordSet: Boolean(setting),
      passwordUpdatedAt: setting?.updatedAt ?? null,
      restoreEnabled: Boolean(updatesDir()),
      localFolder: localBackupRoot(),
    };
  }

  async setPassword(password: string) {
    const encrypted = encryptToken(password);
    await this.prisma.instanceBackupSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', password: encrypted },
      update: { password: encrypted },
    });
    return this.settings();
  }

  private async password() {
    const setting = await this.prisma.instanceBackupSetting.findUnique({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new BadRequestException(
        'Define primeiro a password dos backups do MyHomeLab (Admin → Backup).',
      );
    }
    return decryptToken(setting.password);
  }

  private async lastMigration() {
    const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC LIMIT 1`;
    return rows[0]?.migration_name ?? null;
  }

  /** O .zip com uma pasta por área, com a password guardada. */
  async create(): Promise<BackupFile> {
    const password = await this.password();
    const installed = await getInstalledVersion();
    try {
      return await createInstanceBackup({
        password,
        version: installed.version ?? installed.baseVersion,
        migration: await this.lastMigration(),
      });
    } catch (error) {
      if (!(error instanceof InstanceBackupError)) throw error;
      throw error.unavailable
        ? new ServiceUnavailableException(error.message)
        : new InternalServerErrorException(error.message);
    }
  }

  // ── Repor ────────────────────────────────────────────────────────────────

  private restoreDir() {
    const dir = updatesDir();
    if (!dir) {
      throw new ServiceUnavailableException(
        'Repor um backup pela app só funciona na instalação do servidor. Aqui, usa o myhomelab-restore.',
      );
    }
    return dir;
  }

  /**
   * Abre o .zip enviado com a password, confirma que é um backup que esta versão sabe
   * repor e pede a reposição. O ficheiro enviado é apagado no fim, corra bem ou não.
   */
  async requestRestore(uploadPath: string, password: string) {
    const dir = this.restoreDir();
    try {
      const status = await this.restoreStatus(0);
      if (status.state === 'queued' || status.state === 'running') {
        throw new ConflictException('Já há uma reposição em curso.');
      }
      const update = await fs
        .readFile(join(stateDir(dir), 'status.json'), 'utf8')
        .catch(() => '');
      if (
        update.includes('"state":"running"') ||
        update.includes('"state": "running"')
      ) {
        throw new ConflictException(
          'Há uma atualização a correr. Espera que acabe.',
        );
      }

      let manifest: InstanceBackupManifest;
      try {
        manifest = await readBackupManifest(uploadPath, password);
      } catch (error) {
        if (
          error instanceof BackupPasswordError ||
          error instanceof BackupFormatError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
      const known = await knownMigrations();
      if (
        manifest.migration &&
        known.length > 0 &&
        !known.includes(manifest.migration)
      ) {
        throw new BadRequestException(
          `Este backup${manifest.version ? ` (${manifest.version})` : ''} é de uma versão mais recente do que a instalada. Atualiza o MyHomeLab primeiro e depois repõe.`,
        );
      }

      // O restore.sh (root) lê o .zip e a password daqui, como o utilizador da app, e
      // apaga-os no fim.
      const requests = requestsDir(dir);
      const folder = join(requests, 'restore');
      await fs.mkdir(folder, { recursive: true, mode: 0o700 });
      await fs.copyFile(uploadPath, join(folder, 'backup.zip'));
      await fs.writeFile(join(folder, 'password'), password, { mode: 0o600 });
      const written = join(requests, `.restore-request-${process.pid}`);
      await fs.writeFile(written, 'restore/backup.zip\n', { mode: 0o644 });
      await fs.rename(written, join(requests, 'restore-request'));
      return {
        ...(await this.restoreStatus(0)),
        backupCreatedAt: manifest.createdAt,
      };
    } finally {
      await fs.rm(uploadPath, { force: true });
    }
  }

  async restoreStatus(logLines = 40): Promise<RestoreStatus> {
    const dir = updatesDir();
    if (!dir) return IDLE;
    const pending = await fs
      .readFile(join(requestsDir(dir), 'restore-request'), 'utf8')
      .catch(() => null);
    const raw = await fs
      .readFile(join(stateDir(dir), 'restore-status.json'), 'utf8')
      .catch(() => null);
    let status: RestoreStatus = { ...IDLE };
    if (raw) {
      try {
        status = {
          ...IDLE,
          ...(JSON.parse(raw) as Partial<RestoreStatus>),
          log: [],
        };
      } catch {
        // a meio de ser escrito: fica para a próxima leitura
      }
    }
    if (pending && status.state !== 'running')
      status = { ...IDLE, state: 'queued' };
    if (logLines > 0) {
      const log = await fs
        .readFile(join(stateDir(dir), 'restore.log'), 'utf8')
        .catch(() => '');
      status.log = log
        .replace(ANSI_COLOURS, '')
        .split('\n')
        .filter((line) => line.trim())
        .slice(-logLines);
    }
    return status;
  }
}
