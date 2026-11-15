import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DiskHealthService } from './disk-health.service';

/**
 * De hora a hora lê os discos de todos os servidores. A leitura do dia vai
 * sendo substituída, por isso fica sempre a mais recente de cada dia.
 */
@Injectable()
export class DiskHealthScheduler {
  private readonly logger = new Logger(DiskHealthScheduler.name);
  private checking = false;

  constructor(private readonly diskHealth: DiskHealthService) {}

  @Interval(60 * 60_000)
  async checkDisks(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.diskHealth.checkAll();
    } catch (error) {
      this.logger.error(
        'Falha a verificar os discos',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.checking = false;
    }
  }
}
