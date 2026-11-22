import { randomUUID } from 'crypto';
import { Agent } from 'src/generated/prisma/client/client';
import { AGENT_TEMPLATES } from '../agent-templates';
import { PrismaAgentRepository } from '../repositories/prisma/prisma-agent-repository';
import { PrismaAgentSettingRepository } from '../repositories/prisma/prisma-agent-setting-repository';

/**
 * A equipa do utilizador; na primeira vez cria só o CEO (o Jarvis). O resto da
 * equipa é ele que a monta, na página Workflow ou a pedir ao Jarvis (create_agent com
 * template cria um dos agentes do site, com as instruções e a chave dele). As instruções
 * extra que tinha escrito nos agentes antigos passam para o CEO, para não se perderem.
 */
export async function ensureTeam(
  agents: PrismaAgentRepository,
  settings: PrismaAgentSettingRepository,
  userId: string,
): Promise<Agent[]> {
  const team = await agents.findTeam(userId);
  if (team.length) return team;

  const legacy = new Map(
    (await settings.findAll(userId)).map((setting) => [
      setting.agentKey,
      setting.customPrompt?.trim(),
    ]),
  );
  const starters = AGENT_TEMPLATES.filter((template) => !template.reportsTo);
  const ids = new Map(starters.map((template) => [template.key, randomUUID()]));

  await agents.createTeam(
    userId,
    starters.map((template, position) => ({
      id: ids.get(template.key),
      key: template.key,
      template: template.key,
      name: template.name,
      description: template.description,
      prompt: null,
      extraPrompt:
        template.legacyKeys
          .map((key) => legacy.get(key))
          .filter(Boolean)
          .join('\n\n') || null,
      model: template.model,
      effort: template.effort,
      tools: template.tools,
      reportsToId: template.reportsTo ? ids.get(template.reportsTo)! : null,
      color: template.color,
      isActive: true,
      position,
    })),
  );
  return agents.findTeam(userId);
}
