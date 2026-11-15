import { BadRequestException, NotFoundException } from '@nestjs/common';
import { templatePrompt } from '../agent-templates';
import { PrismaAgentRepository } from '../repositories/prisma/prisma-agent-repository';
import { AgentData } from '../repositories/agent-repository';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { checkAgentChanges } from './checkAgentChanges';

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

/**
 * Muda um agente. O CEO fica sempre no topo e ligado: é ele que fala com o
 * utilizador. Nos agentes do site, instruções vazias ou iguais às do site guardam
 * null, para continuarem a receber as melhorias do site.
 */
export async function updateTeamAgent(
  id: string,
  dto: UpdateAgentDto,
  repository: PrismaAgentRepository,
  userId: string,
) {
  const team = await repository.findTeam(userId);
  const agent = team.find((member) => member.id === id);
  if (!agent) throw new NotFoundException('Agente não encontrado');

  const isRoot = !agent.reportsToId;
  if (isRoot && dto.reportsToId) {
    throw new BadRequestException('O CEO não responde a ninguém');
  }
  if (isRoot && dto.isActive === false) {
    throw new BadRequestException('O CEO não se pode desligar');
  }
  if (!isRoot && dto.reportsToId === null) {
    throw new BadRequestException('Escolhe a quem este agente responde');
  }
  checkAgentChanges(dto, team, agent.id);

  const data: Partial<AgentData> = {};
  if (dto.name !== undefined) data.name = dto.name.trim();
  if (dto.description !== undefined) data.description = dto.description.trim();
  if (dto.extraPrompt !== undefined) {
    data.extraPrompt = dto.extraPrompt?.trim() || null;
  }
  if (dto.model !== undefined) data.model = dto.model;
  if (dto.effort !== undefined) data.effort = dto.effort;
  if (dto.tools !== undefined) data.tools = [...new Set(dto.tools)];
  if (dto.reportsToId !== undefined) data.reportsToId = dto.reportsToId;
  if (dto.color !== undefined) data.color = dto.color;
  if (dto.isActive !== undefined) data.isActive = dto.isActive;

  if (dto.prompt !== undefined) {
    const prompt = normalize(dto.prompt ?? '');
    const original = templatePrompt(agent.template);
    if (original !== null) {
      data.prompt = prompt && prompt !== normalize(original) ? prompt : null;
    } else if (!prompt) {
      throw new BadRequestException('Escreve as instruções do agente');
    } else {
      data.prompt = prompt;
    }
  }

  return repository.update(agent.id, data);
}
