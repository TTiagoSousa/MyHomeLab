import { Module } from '@nestjs/common';
import { BoardModule } from 'src/board/board.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ServerConnectionModule } from 'src/server-connection/server-connection.module';
import { DiskAlertService } from './disk-alert.service';

@Module({
  imports: [BoardModule, NotificationModule, ServerConnectionModule],
  providers: [DiskAlertService],
  exports: [DiskAlertService],
})
export class DiskAlertModule {}
