import type { Agent } from '../../../../Hooks/Agent/useAgents';

export interface TeamRow {
  agent: Agent;
  depth: number;
}

export const orderTeam = (agents: Agent[]): TeamRow[] => {
  const rows: TeamRow[] = [];
  const visit = (agent: Agent, depth: number) => {
    rows.push({ agent, depth });
    agents.filter((member) => member.reportsToId === agent.id).forEach((member) => visit(member, depth + 1));
  };
  agents.filter((agent) => !agent.reportsToId).forEach((root) => visit(root, 0));
  agents.filter((agent) => !rows.some((row) => row.agent.id === agent.id)).forEach((orphan) => visit(orphan, 1));
  return rows;
};

export const teamBelow = (agents: Agent[], id: string): Set<string> => {
  const below = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    agents.forEach((agent) => {
      if (agent.reportsToId && below.has(agent.reportsToId) && !below.has(agent.id)) {
        below.add(agent.id);
        grew = true;
      }
    });
  }
  return below;
};

export const AGENT_COLORS = [1, 2, 3, 4, 5, 6, 7, 8];
