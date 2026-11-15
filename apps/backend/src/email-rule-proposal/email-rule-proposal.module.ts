import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { EmailRuleModule } from 'src/email-rule/email-rule.module';
import { AiCredentialModule } from 'src/ai-credential/ai-credential.module';
import { EmailRuleProposalController } from './email-rule-proposal.controller';
import { EmailRuleProposalService } from './email-rule-proposal.service';
import { EmailRuleProposalScheduler } from './email-rule-proposal.scheduler';

@Module({
  imports: [ConnectedAccountModule, EmailRuleModule, AiCredentialModule],
  controllers: [EmailRuleProposalController],
  providers: [EmailRuleProposalService, EmailRuleProposalScheduler],
  exports: [EmailRuleProposalService],
})
export class EmailRuleProposalModule {}
