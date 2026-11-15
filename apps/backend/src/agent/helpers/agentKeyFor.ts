import { Agent } from 'src/generated/prisma/client/client';

/**
 * A chave de um agente novo, a partir do nome: "Agente de Finanças" → "agente-de-financas".
 * Entra no nome da ferramenta com que o chefe o chama, por isso só letras, números e hífens.
 */
export function agentKeyFor(name: string, team: Agent[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'agente';
  const taken = new Set(team.map((member) => member.key));
  let key = base;
  for (let suffix = 2; taken.has(key); suffix++) key = `${base}-${suffix}`;
  return key;
}
