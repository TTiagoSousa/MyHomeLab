import { Agent } from 'src/generated/prisma/client/client';
import { templatePrompt } from '../agent-templates';
import { TOOL_NAMES } from '../tool-catalog';
import {
  AgentActivity,
  AgentActivityService,
} from 'src/agent-activity/agent-activity.service';

export interface TeamAgentView extends AgentActivity {
  id: string;
  key: string;
  name: string;
  description: string;
  template: string | null;
  isRoot: boolean;
  /** As instruções que o agente usa. */
  prompt: string;
  /** As do site, nos agentes do site; null nos criados pelo utilizador. */
  defaultPrompt: string | null;
  promptEdited: boolean;
  extraPrompt: string | null;
  model: Agent['model'];
  effort: Agent['effort'];
  tools: string[];
  reportsToId: string | null;
  color: number;
  isActive: boolean;
}

/** A equipa com o estado de cada um, para a página Workflow e o Assistente. */
export function listTeam(
  team: Agent[],
  activity: AgentActivityService,
  userId: string,
): TeamAgentView[] {
  const now = new Map(
    activity.snapshot(userId).map((entry) => [entry.agent, entry]),
  );
  return team.map((agent) => {
    const defaultPrompt = templatePrompt(agent.template);
    return {
      agent: agent.key,
      status: 'IDLE',
      action: null,
      since: null,
      lastActiveAt: null,
      ...now.get(agent.key),
      id: agent.id,
      key: agent.key,
      name: agent.name,
      description: agent.description,
      template: agent.template,
      isRoot: !agent.reportsToId,
      prompt: agent.prompt ?? defaultPrompt ?? '',
      defaultPrompt,
      promptEdited: agent.prompt !== null && defaultPrompt !== null,
      extraPrompt: agent.extraPrompt,
      model: agent.model,
      effort: agent.effort,
      tools: agent.tools.filter((tool) => TOOL_NAMES.has(tool)),
      reportsToId: agent.reportsToId,
      color: agent.color,
      isActive: agent.isActive,
    };
  });
}
