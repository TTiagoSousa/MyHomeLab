import { Module } from '@nestjs/common';
import { EmailRuleService } from './email-rule.service';
import { EmailRuleController } from './email-rule.controller';
import { EmailRuleScheduler } from './email-rule.scheduler';
import { PrismaEmailRuleRepository } from './repositories/prisma/prisma-email-rule-repository';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';

@Module({
  imports: [ConnectedAccountModule],
  controllers: [EmailRuleController],
  providers: [
    EmailRuleService,
    EmailRuleScheduler,
    {
      provide: PrismaEmailRuleRepository,
      useClass: PrismaEmailRuleRepository,
    },
  ],
  exports: [PrismaEmailRuleRepository],
})
export class EmailRuleModule {}
