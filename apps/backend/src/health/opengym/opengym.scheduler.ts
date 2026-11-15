import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OpenGymService } from './opengym.service';

@Injectable()
export class OpenGymScheduler {
  private readonly logger = new Logger(OpenGymScheduler.name);

  constructor(private readonly openGym: OpenGymService) {}

  // De 15 em 15 minutos, e cada ligação só corre quando passou a frequência
  // escolhida. Um erro fica guardado na ligação.
  @Cron('0 */15 * * * *', { name: 'OpenGym' })
  async handleScheduledRuns() {
    for (const connection of await this.openGym.dueConnections()) {
      try {
        await this.openGym.sync(connection.userId);
      } catch (error) {
        this.logger.warn(
          `Falha ao sincronizar o openGym de ${connection.userId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
