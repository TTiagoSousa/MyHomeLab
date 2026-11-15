import { Module } from '@nestjs/common';
import { DocsModule } from 'src/docs/docs.module';
import { TodoModule } from 'src/todo/todo.module';
import { BoardModule } from 'src/board/board.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ServerConnectionModule } from 'src/server-connection/server-connection.module';
import { AppUpdateController } from './app-update.controller';
import { AppUpdateService } from './app-update.service';
import { UpdateAttemptService } from './update-attempt.service';
import { UpdateRecordService } from './update-record.service';
import { HaComponentsService } from './ha-components.service';
import { NextcloudAppsService } from './nextcloud-apps.service';
import { UpdateRunnerService } from './update-runner.service';

@Module({
  imports: [
    DocsModule,
    NotificationModule,
    ServerConnectionModule,
    BoardModule,
    TodoModule,
  ],
  controllers: [AppUpdateController],
  providers: [
    AppUpdateService,
    UpdateAttemptService,
    UpdateRecordService,
    HaComponentsService,
    NextcloudAppsService,
    UpdateRunnerService,
  ],
  exports: [AppUpdateService, UpdateAttemptService],
})
export class AppUpdateModule {}
