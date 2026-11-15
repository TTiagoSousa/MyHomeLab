import { AgentContext } from '../agents/agent-context';

function describeAgent(context: AgentContext, agentKey: string) {
  return context.team.find((entry) => entry.key === agentKey) ?? null;
}

function quote(prompt: string | null): string {
  if (!prompt) return '(sem instruções — só o comportamento de origem)';
  return `"${prompt}"`;
}

/** As instruções extra de cada agente da equipa (as que o Jarvis pode propor mudar). */
export function listAgentPrompts(context: AgentContext): string {
  const lines = context.team.map(
    (agent) =>
      `${agent.key} (${agent.name}${agent.reportsToId ? '' : ', tu próprio'}): ${quote(agent.extraPrompt)}`,
  );

  const pending = context.promptProposals.list(context.userId);

  if (pending.length) {
    lines.push('', 'Propostas à espera de autorização:');
    for (const proposal of pending) {
      lines.push(
        `  ${proposal.id} → ${proposal.agentName}: ${quote(proposal.nextPrompt)}`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Não altera nada. Só regista o que se pretende mudar e devolve um código.
 * A alteração a sério fica a cargo do apply_agent_prompt, que o código recusa
 * enquanto o utilizador não responder.
 */
export function proposeAgentPrompt(
  input: { agent_key: string; new_prompt: string | null },
  context: AgentContext,
): string {
  const descriptor = describeAgent(context, input.agent_key);

  if (!descriptor) {
    const known = context.team.map((a) => a.key).join(', ');
    return `Não existe nenhum agente com a chave "${input.agent_key}". Os que existem: ${known}.`;
  }

  const trimmed = input.new_prompt?.trim() || null;
  const previous = descriptor.extraPrompt ?? null;

  if (trimmed === previous) {
    return `As instruções do ${descriptor.name} já são exatamente essas. Não há nada a mudar.`;
  }

  const proposal = context.promptProposals.create({
    userId: context.userId,
    agentKey: descriptor.key,
    agentName: descriptor.name,
    nextPrompt: trimmed,
    previousPrompt: previous,
    turnId: context.turnId,
  });

  return [
    `Proposta ${proposal.id} registada. NÃO está aplicada.`,
    `Agente: ${descriptor.name}`,
    `Antes: ${quote(previous)}`,
    `Depois: ${quote(trimmed)}`,
    '',
    'Mostra isto ao utilizador pelas tuas palavras, diz-lhe exatamente o que passa a ' +
      'valer, e pergunta se autorizas. Não chames o apply_agent_prompt agora — ' +
      'só depois de ele responder que sim, na mensagem seguinte.',
  ].join('\n');
}

/**
 * Descreve as propostas por autorizar, para irem no system prompt de cada volta.
 *
 * É preciso porque o histórico da conversa só guarda o que foi dito — os
 * resultados das ferramentas não sobrevivem à volta em que aconteceram. Sem
 * isto, na mensagem em que o utilizador autoriza, o modelo já não sabe que existe
 * uma proposta nem qual é o código, e volta a propor em vez de aplicar.
 */
export function describePendingProposals(context: AgentContext): string {
  const pending = context.promptProposals.list(context.userId);
  if (!pending.length) return '';

  const lines = pending.map(
    (p) => `  · código ${p.id} — ${p.agentName}: ${quote(p.nextPrompt)}`,
  );

  return (
    '\n\nNeste momento há alterações de prompt já propostas e à espera da ' +
    'autorização do utilizador:\n' +
    lines.join('\n') +
    '\nSe ele disser que sim, chama apply_agent_prompt com esse código — não ' +
    'voltes a propor a mesma coisa, que só cria uma proposta nova e volta a ' +
    'ficar bloqueada. Se ele disser que não, usa discard_agent_prompt.'
  );
}

export async function applyAgentPrompt(
  input: { proposal_id?: string; agent_key?: string },
  context: AgentContext,
): Promise<string> {
  // Aceita o código ou só o agente: se o modelo perdeu o código, o agente chega
  // para encontrar a proposta certa — só há uma em aberto por agente.
  let id = input.proposal_id?.trim();

  if (!id && input.agent_key) {
    const match = context.promptProposals
      .list(context.userId)
      .find((p) => p.agentKey === input.agent_key);
    id = match?.id;
  }

  if (!id) {
    const pending = context.promptProposals.list(context.userId);
    return pending.length
      ? 'Falta dizer qual a proposta. As que estão em aberto: ' +
          pending.map((p) => `${p.id} (${p.agentName})`).join(', ')
      : 'Não há nenhuma proposta em aberto para aplicar.';
  }

  const check = context.promptProposals.authorise(
    id,
    context.turnId,
    context.userId,
  );

  if (!check.ok) return check.reason;

  const { proposal } = check;

  const agent = describeAgent(context, proposal.agentKey);
  if (!agent) {
    context.promptProposals.discard(proposal.id);
    return `O ${proposal.agentName} já não existe na equipa. A proposta foi descartada.`;
  }
  await context.agentRepository.update(agent.id, {
    extraPrompt: proposal.nextPrompt,
  });

  context.promptProposals.discard(proposal.id);

  return proposal.nextPrompt
    ? `Feito. O ${proposal.agentName} passa a seguir estas instruções: ${quote(proposal.nextPrompt)}`
    : `Feito. O ${proposal.agentName} ficou sem instruções extra e volta ao comportamento de origem.`;
}

export function discardAgentPrompt(
  input: { proposal_id: string },
  context: AgentContext,
): string {
  const proposal = context.promptProposals.find(
    input.proposal_id,
    context.userId,
  );
  if (!proposal) return 'Não existe nenhuma proposta com esse código.';

  context.promptProposals.discard(proposal.id);
  return `Proposta ${proposal.id} descartada. As instruções do ${proposal.agentName} ficaram como estavam.`;
}
