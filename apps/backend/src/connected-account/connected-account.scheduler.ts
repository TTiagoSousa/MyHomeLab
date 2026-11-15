import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConnectedAccountService } from './connected-account.service';

/**
 * De 6 em 6 horas (e um minuto depois de arrancar) vê se as apps ligadas que
 * dizem a versão já têm uma nova. Uma volta não arranca enquanto a anterior
 * não acabar.
 */
@Injectable()
export class ConnectedAccountScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConnectedAccountScheduler.name);
  private checking = false;

  constructor(private readonly accounts: ConnectedAccountService) {}

  onApplicationBootstrap() {
    setTimeout(() => void this.checkVersions(), 60_000);
  }

  @Interval(6 * 60 * 60_000)
  async checkVersions(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.accounts.checkAllVersions();
    } catch (error) {
      this.logger.error(
        'Falha a verificar as versões das apps ligadas',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.checking = false;
    }
  }
}
