import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TodoSyncService } from './todo-sync.service';

/**
 * Todos os minutos vê quem tem a sincronização ligada e já passou o intervalo que
 * escolheu (5 min a 1 dia). Uma volta não arranca enquanto a anterior não acabar.
 */
@Injectable()
export class TodoSyncScheduler {
  private readonly logger = new Logger(TodoSyncScheduler.name);
  private syncing = false;

  constructor(private readonly sync: TodoSyncService) {}

  @Interval(60_000)
  async syncAll(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.sync.runDue();
    } catch (error) {
      this.logger.error(
        'Falha a sincronizar as tarefas',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.syncing = false;
    }
  }
}
