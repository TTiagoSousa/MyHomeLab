import { Module } from '@nestjs/common';
import { AppUpdateModule } from 'src/app-update/app-update.module';
import { AgentScheduleService } from './agent-schedule.service';

/** Os agendamentos em si (guardar, calcular a próxima vez); os agentes usam-no nas ferramentas. */
@Module({
  imports: [AppUpdateModule],
  providers: [AgentScheduleService],
  exports: [AgentScheduleService],
})
export class AgentScheduleModule {}
