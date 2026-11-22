import { Agent } from 'src/generated/prisma/client/client';

/**
 * Chaves que nenhum agente pode ter: em todo o código, quem fez uma ação é "user" (o
 * utilizador), "myhomelab"/"system" (o próprio MyHomeLab) ou a chave de um agente. Um
 * agente chamado "User" ficava com a chave de quem manda. O "ceo" é o do Jarvis.
 */
export const RESERVED_AGENT_KEYS = new Set([
  'user',
  'myhomelab',
  'system',
  'ceo',
  'terminal',
]);

/** "user", "MyHomeLab"… — quem fez uma ação não foi um agente da equipa. */
export const isReservedAgentKey = (key: string) =>
  RESERVED_AGENT_KEYS.has(key.trim().toLowerCase());

/**
 * A chave de um agente novo, a partir do nome: "Agente de Finanças" → "agente-de-financas".
 * Entra no nome da ferramenta com que o chefe o chama, por isso só letras, números e hífens.
 */
export function agentKeyFor(name: string, team: Agent[]): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'agente';
  const base = RESERVED_AGENT_KEYS.has(slug) ? `agente-${slug}` : slug;
  const taken = new Set(team.map((member) => member.key));
  let key = base;
  for (let suffix = 2; taken.has(key); suffix++) key = `${base}-${suffix}`;
  return key;
}
