import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BackupController } from './backup.controller';
import { BackupScheduler } from './backup.scheduler';
import { BackupService } from './backup.service';

@Module({
  imports: [NotificationModule, ConnectedAccountModule],
  controllers: [BackupController],
  providers: [BackupService, BackupScheduler],
  exports: [BackupService],
})
export class BackupModule {}
