import { Injectable } from '@nestjs/common';
import { PrismaAgentSettingRepository } from './repositories/prisma/prisma-agent-setting-repository';
import { PrismaAgentRepository } from './repositories/prisma/prisma-agent-repository';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { ensureTeam } from './helpers/ensureTeam';
import { listTeam } from './helpers/listTeam';
import { createTeamAgent } from './helpers/createTeamAgent';
import { updateTeamAgent } from './helpers/updateTeamAgent';
import { deleteTeamAgent } from './helpers/deleteTeamAgent';
import { TOOL_CATALOG } from './tool-catalog';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateAssistantPermissionsDto } from './dto/update-assistant-permissions.dto';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentSettingRepository: PrismaAgentSettingRepository,
    private readonly agentRepository: PrismaAgentRepository,
    private readonly activity: AgentActivityService,
  ) {}

  /** A equipa de agentes, com o estado de cada um (criada na primeira vez). */
  async findAll(userId: string) {
    const team = await ensureTeam(
      this.agentRepository,
      this.agentSettingRepository,
      userId,
    );
    return listTeam(team, this.activity, userId);
  }

  /** As ferramentas que se podem dar a um agente. */
  findTools() {
    return TOOL_CATALOG.map(({ name, group, access }) => ({
      name,
      group,
      access,
    }));
  }

  async create(dto: CreateAgentDto, userId: string) {
    await ensureTeam(this.agentRepository, this.agentSettingRepository, userId);
    await createTeamAgent(dto, this.agentRepository, userId);
    return this.findAll(userId);
  }

  async update(id: string, dto: UpdateAgentDto, userId: string) {
    await updateTeamAgent(id, dto, this.agentRepository, userId);
    return this.findAll(userId);
  }

  async remove(id: string, userId: string) {
    await deleteTeamAgent(id, this.agentRepository, userId);
    return this.findAll(userId);
  }

  /** O registo dos agentes, do mais recente para trás. */
  async findLogs(
    userId: string,
    query: { agent?: string; before?: string; limit?: string },
  ) {
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
    const before = query.before ? new Date(query.before) : undefined;
    return this.activity.logPage(userId, {
      agent: query.agent || undefined,
      before: before && !isNaN(before.getTime()) ? before : undefined,
      limit,
    });
  }

  async findPermissions(userId: string) {
    return {
      denied: await this.agentSettingRepository.findDeniedPermissions(userId),
    };
  }

  async updatePermissions(userId: string, dto: UpdateAssistantPermissionsDto) {
    return {
      denied: await this.agentSettingRepository.saveDeniedPermissions(
        userId,
        dto.denied,
      ),
    };
  }
}
