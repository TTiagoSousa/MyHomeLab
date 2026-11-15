import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ServiceMonitorService } from './service-monitor.service';

/**
 * De 30 em 30 s acerta os serviços das apps ligadas (servidor/CT) e vê que
 * serviços já passaram o seu intervalo e testa-os; de
 * 5 em 5 min confirma que as máquinas associadas ainda existem no Proxmox.
 * Uma volta não arranca enquanto a anterior não acabar.
 */
@Injectable()
export class ServiceMonitorScheduler {
  private readonly logger = new Logger(ServiceMonitorScheduler.name);
  private checkingServices = false;
  private checkingMachines = false;

  constructor(private readonly monitors: ServiceMonitorService) {}

  @Interval(30_000)
  async checkServices(): Promise<void> {
    if (this.checkingServices) return;
    this.checkingServices = true;
    try {
      await this.monitors.syncApps();
      await this.monitors.checkDue();
    } catch (error) {
      this.logger.error(
        'Falha a verificar serviços',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.checkingServices = false;
    }
  }

  @Interval(5 * 60_000)
  async checkMachines(): Promise<void> {
    if (this.checkingMachines) return;
    this.checkingMachines = true;
    try {
      await this.monitors.checkMachines();
    } catch (error) {
      this.logger.error(
        'Falha a verificar máquinas',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.checkingMachines = false;
    }
  }
}
