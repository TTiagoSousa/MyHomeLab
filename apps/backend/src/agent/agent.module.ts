import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { PrismaAgentSettingRepository } from './repositories/prisma/prisma-agent-setting-repository';
import { PrismaAgentRepository } from './repositories/prisma/prisma-agent-repository';
import { AgentPromptProposalService } from './agent-prompt-proposal.service';
import { AgentAccessService } from './agent-access.service';

@Module({
  imports: [PrismaModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    PrismaAgentSettingRepository,
    PrismaAgentRepository,
    AgentPromptProposalService,
    AgentAccessService,
  ],
  exports: [
    AgentAccessService,
    PrismaAgentSettingRepository,
    PrismaAgentRepository,
    AgentPromptProposalService,
  ],
})
export class AgentModule {}
