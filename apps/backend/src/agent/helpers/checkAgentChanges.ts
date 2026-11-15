import { BadRequestException } from '@nestjs/common';
import { Agent } from 'src/generated/prisma/client/client';
import { TOOL_NAMES } from '../tool-catalog';

/**
 * As ferramentas têm de existir no catálogo, e o chefe tem de ser da equipa sem
 * fechar um círculo (A responde a B, que responde a A), que punha os agentes a
 * delegar uns nos outros sem fim.
 */
export function checkAgentChanges(
  changes: { tools?: string[]; reportsToId?: string | null },
  team: Agent[],
  agentId: string | null,
): void {
  const unknown = changes.tools?.filter((tool) => !TOOL_NAMES.has(tool)) ?? [];
  if (unknown.length) {
    throw new BadRequestException(
      `Ferramentas desconhecidas: ${unknown.join(', ')}`,
    );
  }

  if (!changes.reportsToId) return;
  let boss = team.find((member) => member.id === changes.reportsToId);
  if (!boss) throw new BadRequestException('Esse chefe não é da tua equipa');
  while (boss) {
    if (boss.id === agentId) {
      throw new BadRequestException(
        'Um agente não pode responder a alguém da sua própria equipa',
      );
    }
    const next: string | null = boss.reportsToId;
    boss = team.find((member) => member.id === next);
  }
}
