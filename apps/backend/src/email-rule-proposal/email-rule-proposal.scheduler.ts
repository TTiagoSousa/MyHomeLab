import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailRuleProposalService } from './email-rule-proposal.service';

/**
 * De 15 em 15 minutos: analisa as contas cuja frequência de propostas venceu e
 * implementa as propostas que passaram o prazo. A frequência e a data da
 * última análise são próprias (proposalFrequency / lastProposalRunAt) — não se
 * misturam com as da execução das regras.
 */
@Injectable()
export class EmailRuleProposalScheduler {
  private readonly logger = new Logger(EmailRuleProposalScheduler.name);
  private running = false;

  constructor(private readonly proposals: EmailRuleProposalService) {}

  @Cron('0 7,22,37,52 * * * *', { name: 'Propostas de regras de email' })
  async handleScheduled(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.proposals.runDueImplementations();
      await this.proposals.runDueAnalyses();
    } catch (error) {
      this.logger.error(
        'Falha nas regras propostas',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
