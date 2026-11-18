import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { DiskAlertModule } from 'src/disk-alert/disk-alert.module';
import {
  CronJobController,
  ServerCronJobController,
} from './cron-job.controller';
import { CronJobScheduler } from './cron-job.scheduler';
import { CronJobService } from './cron-job.service';

@Module({
  imports: [ConnectedAccountModule, DiskAlertModule],
  controllers: [CronJobController, ServerCronJobController],
  providers: [CronJobService, CronJobScheduler],
})
export class CronJobModule {}
