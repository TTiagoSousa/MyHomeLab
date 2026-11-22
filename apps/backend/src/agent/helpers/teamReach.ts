import { Agent } from 'src/generated/prisma/client/client';

/**
 * Se `key` é o próprio agente ou alguém abaixo dele na equipa (os subordinados e os
 * deles). Um agente só agenda trabalho para si e para quem lhe responde: o infra não
 * põe o CEO a correr instruções dele.
 */
export function withinReach(team: Agent[], bossKey: string, key: string) {
  if (bossKey === key) return true;
  const boss = team.find((member) => member.key === bossKey);
  let current = team.find((member) => member.key === key);
  for (let hops = 0; boss && current?.reportsToId && hops < 20; hops++) {
    if (current.reportsToId === boss.id) return true;
    current = team.find((member) => member.id === current!.reportsToId);
  }
  return false;
}
