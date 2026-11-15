import { Module } from '@nestjs/common';
import { AssistantModule } from 'src/assistant/assistant.module';
import { NotificationModule } from 'src/notification/notification.module';
import { AgentScheduleModule } from './agent-schedule.module';
import { AgentScheduleController } from './agent-schedule.controller';
import { AgentScheduleRunner } from './agent-schedule.runner';
import { DailySummaryScheduler } from './daily-summary.scheduler';

/**
 * Quem põe os agendamentos a correr: fica fora do AgentScheduleModule porque precisa
 * do assistente (que por sua vez usa os agendamentos nas ferramentas).
 */
@Module({
  imports: [AgentScheduleModule, AssistantModule, NotificationModule],
  controllers: [AgentScheduleController],
  providers: [AgentScheduleRunner, DailySummaryScheduler],
})
export class AgentScheduleRunnerModule {}
