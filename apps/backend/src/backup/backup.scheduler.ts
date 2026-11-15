import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  private busy = false;

  constructor(private readonly backups: BackupService) {}

  // De 15 em 15 minutos, e cada backup só corre quando passou a frequência
  // escolhida. Um a um, para não pôr vários serviços a escrever ao mesmo tempo:
  // se a volta anterior ainda não acabou (um backup grande), esta fica de fora.
  @Cron('0 */15 * * * *', { name: 'Backups das apps' })
  async handleScheduledRuns() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const job of await this.backups.dueJobs()) {
        const result = await this.backups.run(job.id);
        if (!result.ok) {
          this.logger.warn(`Backup ${job.id} falhou: ${result.error}`);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
