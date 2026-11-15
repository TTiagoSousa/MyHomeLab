import { BadRequestException } from '@nestjs/common';
import { PrismaAgentRepository } from '../repositories/prisma/prisma-agent-repository';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { checkAgentChanges } from './checkAgentChanges';
import { agentKeyFor } from './agentKeyFor';

/** Um agente novo, criado pelo utilizador. Sem chefe escolhido, responde ao CEO. */
export async function createTeamAgent(
  dto: CreateAgentDto,
  repository: PrismaAgentRepository,
  userId: string,
) {
  const team = await repository.findTeam(userId);
  const root = team.find((member) => !member.reportsToId);
  const reportsToId = dto.reportsToId ?? root?.id ?? null;
  checkAgentChanges({ tools: dto.tools, reportsToId }, team, null);

  const prompt = dto.prompt.trim();
  if (!prompt) throw new BadRequestException('Escreve as instruções do agente');

  return repository.create(userId, {
    key: agentKeyFor(dto.name, team),
    template: null,
    name: dto.name.trim(),
    description: dto.description.trim(),
    prompt,
    extraPrompt: dto.extraPrompt?.trim() || null,
    model: dto.model,
    effort: dto.effort,
    tools: [...new Set(dto.tools)],
    reportsToId,
    color: dto.color,
    isActive: dto.isActive ?? true,
    position: Math.max(0, ...team.map((member) => member.position)) + 1,
  });
}
