import { Module } from '@nestjs/common';
import { BoardModule } from 'src/board/board.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ServerConnectionModule } from 'src/server-connection/server-connection.module';
import { ServiceMonitorController } from './service-monitor.controller';
import { ServiceMonitorService } from './service-monitor.service';
import { ServiceMonitorScheduler } from './service-monitor.scheduler';
import { ServiceDownTaskService } from './service-down-task.service';

@Module({
  imports: [NotificationModule, ServerConnectionModule, BoardModule],
  controllers: [ServiceMonitorController],
  providers: [
    ServiceMonitorService,
    ServiceDownTaskService,
    ServiceMonitorScheduler,
  ],
  exports: [ServiceMonitorService],
})
export class ServiceMonitorModule {}
