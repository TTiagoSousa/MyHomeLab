import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaEmailRuleRepository } from './repositories/prisma/prisma-email-rule-repository';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { runEmailRules } from './helpers/runEmailRules';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { RUN_FREQUENCY_INTERVAL_MS } from '@myhomelab/shared';

@Injectable()
export class EmailRuleScheduler {
  private readonly logger = new Logger(EmailRuleScheduler.name);
  private running = false;

  constructor(
    private readonly emailRuleRepository: PrismaEmailRuleRepository,
    private readonly connectedAccountRepository: PrismaConnectedAccountRepository,
    private readonly activity: AgentActivityService,
  ) {}

  // De 15 em 15 minutos, que é a frequência mais curta que se pode escolher
  // (o CronExpression não tem constante para 15). Quem tiver frequências maiores
  // é filtrado logo a seguir pelo lastRunAt.
  @Cron('0 */15 * * * *', { name: 'Regras do Gmail' })
  async handleScheduledRuns() {
    // Uma corrida lenta (Google lento, muitos emails) não pode ter outra por cima a mexer
    // nos mesmos emails e a gastar a quota.
    if (this.running) return;
    this.running = true;
    try {
      await this.runDueAccounts();
    } finally {
      this.running = false;
    }
  }

  private async runDueAccounts() {
    // Só contas Gmail: as regras de email contra outras contas falhavam sempre e
    // reescreviam o lastRunAt delas.
    const accounts = (
      await this.connectedAccountRepository.findAllActiveAcrossUsers()
    ).filter((account) => account.provider === ConnectionProvider.GMAIL);

    for (const account of accounts) {
      const dueMs = RUN_FREQUENCY_INTERVAL_MS[account.runFrequency];
      const isDue =
        !account.lastRunAt || Date.now() - account.lastRunAt.getTime() >= dueMs;
      if (!isDue) continue;

      try {
        // O cron das regras é trabalho de quem trata do email na equipa, tanto como uma pergunta no
        // chat — é isto que faz a página Workflow mostrar atividade ao longo do dia, e
        // não só nos poucos segundos em que se fala com ele.
        await this.activity.trackOwner(
          account.userId,
          'list_email_rules',
          `a correr as regras de ${account.emailAddress ?? 'uma conta'}`,
          () =>
            runEmailRules(
              account.id,
              'INBOX',
              this.emailRuleRepository,
              this.connectedAccountRepository,
            ),
        );
      } catch (error) {
        // Sem escrever o lastRunAt: a página dizia "correu há 5 min" quando tinha falhado. O
        // runEmailRules só o escreve no fim de uma corrida bem feita; a que falhou volta a
        // tentar no próximo quarto de hora. Uma conta com o acesso revogado fica inativa
        // (ensureFreshAccessToken) e sai desta lista, por isso não fica a falhar em ciclo.
        this.logger.error(
          `Falha ao executar regras da conta ${account.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
