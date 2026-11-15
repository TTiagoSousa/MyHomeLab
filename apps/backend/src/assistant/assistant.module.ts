import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { TerminalController } from './terminal.controller';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { EmailRuleModule } from 'src/email-rule/email-rule.module';
import { AgentModule } from 'src/agent/agent.module';
import { AiCredentialModule } from 'src/ai-credential/ai-credential.module';
import { ServerConnectionModule } from 'src/server-connection/server-connection.module';
import { ServiceMonitorModule } from 'src/service-monitor/service-monitor.module';
import { DiskHealthModule } from 'src/disk-health/disk-health.module';
import { NotificationModule } from 'src/notification/notification.module';
import { HealthModule } from 'src/health/health.module';
import { EmailRuleProposalModule } from 'src/email-rule-proposal/email-rule-proposal.module';
import { BackupModule } from 'src/backup/backup.module';
import { DocsModule } from 'src/docs/docs.module';
import { TodoModule } from 'src/todo/todo.module';
import { AppUpdateModule } from 'src/app-update/app-update.module';
import { UpdateStudyScheduler } from './update-study.scheduler';
import { AgentScheduleModule } from 'src/agent-schedule/agent-schedule.module';
import { BoardModule } from 'src/board/board.module';

@Module({
  imports: [
    ConnectedAccountModule,
    EmailRuleModule,
    AgentModule,
    AiCredentialModule,
    ServerConnectionModule,
    ServiceMonitorModule,
    DiskHealthModule,
    NotificationModule,
    HealthModule,
    EmailRuleProposalModule,
    BackupModule,
    DocsModule,
    AppUpdateModule,
    AgentScheduleModule,
    BoardModule,
    TodoModule,
  ],
  controllers: [AssistantController, TerminalController],
  providers: [AssistantService, UpdateStudyScheduler],
  exports: [AssistantService],
})
export class AssistantModule {}
