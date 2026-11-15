import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { TodoSyncController } from './todo-sync.controller';
import { TodoSyncScheduler } from './todo-sync.scheduler';
import { TodoSyncService } from './todo-sync.service';

@Module({
  imports: [ConnectedAccountModule],
  controllers: [TodoSyncController],
  providers: [TodoSyncService, TodoSyncScheduler],
  exports: [TodoSyncService],
})
export class TodoSyncModule {}
