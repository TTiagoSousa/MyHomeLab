import { BadRequestException } from '@nestjs/common';
import { PrismaAgentRepository } from '../repositories/prisma/prisma-agent-repository';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { checkAgentChanges } from './checkAgentChanges';
import { agentKeyFor } from './agentKeyFor';
import { AGENT_TEMPLATES } from '../agent-templates';

/**
 * Um agente novo, criado pelo utilizador. Sem chefe escolhido, responde ao CEO.
 * Com `template`, é um dos agentes do site (as instruções e a chave dele).
 */
export async function createTeamAgent(
  dto: CreateAgentDto,
  repository: PrismaAgentRepository,
  userId: string,
) {
  const team = await repository.findTeam(userId);
  const root = team.find((member) => !member.reportsToId);
  const reportsToId = dto.reportsToId ?? root?.id ?? null;
  checkAgentChanges({ tools: dto.tools, reportsToId }, team, null);

  const template = dto.template
    ? AGENT_TEMPLATES.find(
        (entry) => entry.key === dto.template && entry.reportsTo,
      )
    : undefined;
  if (dto.template && !template) {
    throw new BadRequestException(`Não há o agente do site "${dto.template}"`);
  }

  const prompt = dto.prompt.trim();
  if (!prompt && !template) {
    throw new BadRequestException('Escreve as instruções do agente');
  }
  const keyFree =
    template && !team.some((member) => member.key === template.key);

  return repository.create(userId, {
    key: keyFree ? template.key : agentKeyFor(dto.name, team),
    template: template?.key ?? null,
    name: dto.name.trim(),
    description: dto.description.trim(),
    // Com as do site, fica null: recebe as melhorias do site.
    prompt:
      template && (!prompt || prompt === template.prompt.trim())
        ? null
        : prompt,
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
