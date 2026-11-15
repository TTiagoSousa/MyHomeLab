import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { ServerConnectionModule } from 'src/server-connection/server-connection.module';
import { DiskHealthController } from './disk-health.controller';
import { DiskHealthService } from './disk-health.service';
import { DiskHealthScheduler } from './disk-health.scheduler';

@Module({
  imports: [NotificationModule, ServerConnectionModule],
  controllers: [DiskHealthController],
  providers: [DiskHealthService, DiskHealthScheduler],
  exports: [DiskHealthService],
})
export class DiskHealthModule {}
