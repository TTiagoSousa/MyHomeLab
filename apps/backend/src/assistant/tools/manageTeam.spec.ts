import type { Agent } from 'src/generated/prisma/client/client';
import { planAgentChange, TeamContext } from './manageTeam';

const ceo = {
  id: 'ceo-id',
  key: 'ceo',
  template: 'ceo',
  name: 'Jarvis',
  reportsToId: null,
} as Agent;

const context = { userId: 'u1', team: [ceo] } as unknown as TeamContext;

describe('planAgentChange com template', () => {
  it('um agente do site vem com o nome, as instruções, as ferramentas e o chefe do site', () => {
    const plan = planAgentChange('create', { template: 'infra' }, context);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.agentName).toBe('Engenheiro de Infraestrutura');
    expect(plan.input).toMatchObject({ template: 'infra', reports_to: 'ceo' });
    expect(plan.addedTools.map((tool) => tool.name)).toContain(
      'ha_update_install',
    );
    expect(plan.addedTools.map((tool) => tool.name)).not.toContain(
      'docs_decide',
    );
  });

  it('um template que não existe é recusado com a lista', () => {
    expect(planAgentChange('create', { template: 'xpto' }, context)).toMatch(
      /Não há o agente do site "xpto"/,
    );
  });

  it('sem template, continua a pedir nome, descrição e instruções', () => {
    expect(planAgentChange('create', { name: 'X' }, context)).toMatch(
      /precisa de nome, descrição e instruções/,
    );
  });
});
