import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronJobService } from './cron-job.service';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class CronJobScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(CronJobScheduler.name);
  private ticking = false;

  constructor(private readonly cronJobs: CronJobService) {}

  onApplicationBootstrap() {
    void this.cronJobs
      .fixMissingNextRun()
      .catch((error: unknown) =>
        this.logger.warn(`Cron jobs ao arrancar: ${errorText(error)}`),
      );
  }

  // De minuto a minuto: as tarefas das apps que chegaram à hora.
  @Cron('20 * * * * *', { name: 'Cron jobs das apps' })
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.cronJobs.runDue();
    } catch (error) {
      this.logger.warn(`Cron jobs das apps: ${errorText(error)}`);
    } finally {
      this.ticking = false;
    }
  }
}
