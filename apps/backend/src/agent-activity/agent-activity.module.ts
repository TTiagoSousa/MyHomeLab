import { Global, Module } from '@nestjs/common';
import { AgentActivityService } from './agent-activity.service';
import { PrismaAgentLogRepository } from './repositories/prisma/prisma-agent-log-repository';
import { PrismaAgentRepository } from 'src/agent/repositories/prisma/prisma-agent-repository';

/**
 * Global porque a atividade é transversal: os agentes marcam-na, os schedulers de
 * email também, e a página Agents lê-a. Importar isto em cada módulo que a toca
 * criava dependências circulares entre email-rule e assistant.
 */
@Global()
@Module({
  providers: [
    AgentActivityService,
    PrismaAgentLogRepository,
    PrismaAgentRepository,
  ],
  exports: [AgentActivityService],
})
export class AgentActivityModule {}
