import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { CronJobController } from './cron-job.controller';
import { CronJobScheduler } from './cron-job.scheduler';
import { CronJobService } from './cron-job.service';

@Module({
  imports: [ConnectedAccountModule],
  controllers: [CronJobController],
  providers: [CronJobService, CronJobScheduler],
})
export class CronJobModule {}
