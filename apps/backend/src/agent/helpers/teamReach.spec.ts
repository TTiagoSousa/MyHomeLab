import { Agent } from 'src/generated/prisma/client/client';
import { withinReach } from './teamReach';

const agent = (id: string, key: string, reportsToId: string | null) =>
  ({ id, key, reportsToId }) as Agent;
const team = [
  agent('1', 'ceo', null),
  agent('2', 'infra', '1'),
  agent('3', 'redes', '2'),
  agent('4', 'admin', '1'),
];

describe('a quem um agente pode passar trabalho agendado', () => {
  it('a si próprio e a quem está abaixo dele', () => {
    expect(withinReach(team, 'infra', 'infra')).toBe(true);
    expect(withinReach(team, 'infra', 'redes')).toBe(true);
    expect(withinReach(team, 'ceo', 'redes')).toBe(true);
  });

  it('nunca ao chefe nem a um colega', () => {
    expect(withinReach(team, 'infra', 'ceo')).toBe(false);
    expect(withinReach(team, 'infra', 'admin')).toBe(false);
    expect(withinReach(team, 'redes', 'infra')).toBe(false);
  });
});
