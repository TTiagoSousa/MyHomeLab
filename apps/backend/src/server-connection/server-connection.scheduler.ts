import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ServerConnectionService } from './server-connection.service';

/**
 * De 6 em 6 horas (e dois minutos depois de arrancar) vê se os servidores Proxmox
 * têm uma versão nova do Proxmox VE para instalar. Uma volta não arranca
 * enquanto a anterior não acabar.
 */
@Injectable()
export class ServerConnectionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServerConnectionScheduler.name);
  private checking = false;

  constructor(private readonly servers: ServerConnectionService) {}

  onApplicationBootstrap() {
    setTimeout(() => void this.checkUpdates(), 120_000);
  }

  @Interval(6 * 60 * 60_000)
  async checkUpdates(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.servers.checkAllUpdates();
    } catch (error) {
      this.logger.error(
        'Falha a verificar as atualizações dos servidores',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.checking = false;
    }
  }
}
