import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BackupController } from './backup.controller';
import { BackupScheduler } from './backup.scheduler';
import { BackupService } from './backup.service';
import { InstanceBackupController } from './instance-backup.controller';
import { InstanceBackupService } from './instance-backup.service';

@Module({
  imports: [NotificationModule, ConnectedAccountModule],
  controllers: [InstanceBackupController, BackupController],
  providers: [BackupService, InstanceBackupService, BackupScheduler],
  exports: [BackupService],
})
export class BackupModule {}
