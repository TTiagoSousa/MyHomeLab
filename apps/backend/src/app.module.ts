import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CategoryModule } from './category/category.module';
import { ServiceModule } from './service/service.module';
import { ConnectedAccountModule } from './connected-account/connected-account.module';
import { EmailRuleModule } from './email-rule/email-rule.module';
import { AgentActivityModule } from './agent-activity/agent-activity.module';
import { AgentModule } from './agent/agent.module';
import { AssistantModule } from './assistant/assistant.module';
import { SystemModule } from './system/system.module';
import { AiCredentialModule } from './ai-credential/ai-credential.module';
import { ClaudeCodeModule } from './claude-code/claude-code.module';
import { ServerConnectionModule } from './server-connection/server-connection.module';
import { NotificationModule } from './notification/notification.module';
import { ServiceMonitorModule } from './service-monitor/service-monitor.module';
import { DiskHealthModule } from './disk-health/disk-health.module';
import { EmailRuleProposalModule } from './email-rule-proposal/email-rule-proposal.module';
import { HealthModule } from './health/health.module';
import { BackupModule } from './backup/backup.module';
import { CronJobModule } from './cron-job/cron-job.module';
import { DocsModule } from './docs/docs.module';
import { TodoModule } from './todo/todo.module';
import { TodoSyncModule } from './todo-sync/todo-sync.module';
import { BoardModule } from './board/board.module';
import { AppUpdateModule } from './app-update/app-update.module';
import { AgentScheduleRunnerModule } from './agent-schedule/agent-schedule-runner.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    CategoryModule,
    ServiceModule,
    ConnectedAccountModule,
    EmailRuleModule,
    AssistantModule,
    SystemModule,
    AgentActivityModule,
    AgentModule,
    AiCredentialModule,
    ClaudeCodeModule,
    ServerConnectionModule,
    NotificationModule,
    ServiceMonitorModule,
    DiskHealthModule,
    EmailRuleProposalModule,
    HealthModule,
    BackupModule,
    CronJobModule,
    DocsModule,
    TodoModule,
    TodoSyncModule,
    BoardModule,
    AppUpdateModule,
    AgentScheduleRunnerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
