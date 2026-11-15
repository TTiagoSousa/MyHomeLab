import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { AgentScheduleService } from 'src/agent-schedule/agent-schedule.service';
import { targetLink, updateLabel } from 'src/app-update/helpers/updateFields';
import { AssistantService } from './assistant.service';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class UpdateStudyScheduler {
  private readonly logger = new Logger(UpdateStudyScheduler.name);
  /** Os utilizadores com uma instalação pedida ao agente (uma de cada vez). */
  private readonly installing = new Set<string>();

  constructor(
    private readonly updates: AppUpdateService,
    private readonly schedules: AgentScheduleService,
    private readonly assistant: AssistantService,
  ) {}

  // De minuto a minuto: as que estão em Espera por estudo ganham o disparo
  // "Estudar …" (corre nos Disparos, um de cada vez por utilizador). De 10 em 10
  // minutos: as peças instaladas e as verificações.
  @Cron('30 * * * * *', { name: 'Estudos das atualizações' })
  async queueStudies() {
    for (const update of (await this.updates.pendingStudies()).slice(0, 2)) {
      await this.schedules
        .scheduleStudy({
          id: update.id,
          userId: update.userId,
          link: targetLink(update),
          label: `${updateLabel(update)} ${update.toVersion}`,
        })
        .catch((error: unknown) =>
          this.logger.warn(
            `Marcar o estudo de ${update.id}: ${errorText(error)}`,
          ),
        );
    }
  }

  // De minuto a minuto: o que ele pôs em Ready to update instala-se logo, uma de
  // cada vez por utilizador.
  @Cron('15 * * * * *', { name: 'Instalar atualizações (Ready to update)' })
  async handleInstalls() {
    for (const update of await this.updates.pendingInstalls(this.installing)) {
      this.installing.add(update.userId);
      void this.assistant
        .installUpdate(update.userId, update.id)
        .catch((error: unknown) =>
          this.logger.warn(
            `Instalar a atualização ${update.id}: ${errorText(error)}`,
          ),
        )
        .finally(() => this.installing.delete(update.userId));
    }
  }

  @Cron('0 */10 * * * *', { name: 'Verificar atualizações instaladas' })
  async handleVerifications() {
    await this.updates
      .checkPreparedComponents()
      .catch((error: unknown) =>
        this.logger.warn(`Peças instaladas: ${errorText(error)}`),
      );
    for (const update of await this.updates.pendingVerifications()) {
      await this.assistant
        .verifyUpdate(update.userId, update.id)
        .catch(async (error: unknown) => {
          this.logger.warn(
            `Verificar a atualização ${update.id}: ${errorText(error)}`,
          );
          await this.updates.markVerify(update.id);
          await this.updates.verifyStalled(update.id, errorText(error));
        });
    }
  }
}
