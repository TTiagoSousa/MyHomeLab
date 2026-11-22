interface Proposed {
  status: string;
  conversationId: string | null;
  turnId: string | null;
}

interface Turn {
  source?: string;
  depth?: number;
  conversationId?: string;
  turnId: string;
}

/**
 * Se o Jarvis pode decidir esta proposta pelo chat ("aprovo" dele) e, se não, porquê.
 * Só vale no chat, no agente de topo (um subagente recebe o pedido do chefe, não as
 * palavras dele), para uma proposta desta conversa feita numa volta anterior: a
 * volta que a criou não a pode aprovar, e uma proposta de outro sítio decide-se lá.
 */
export function chatDecisionBlock(
  proposal: Proposed,
  turn: Turn,
): string | null {
  if (turn.source !== 'chat' || (turn.depth ?? 0) > 0) {
    return 'Recusado: isto só se decide no chat, quando ele o diz ao Jarvis, ou no cartão.';
  }
  if (proposal.status !== 'PENDING') {
    return 'Esta proposta já foi decidida.';
  }
  if (
    !proposal.conversationId ||
    proposal.conversationId !== turn.conversationId
  ) {
    return 'Recusado: esta proposta não foi feita nesta conversa. Ele decide-a no cartão onde ela aparece.';
  }
  if (!proposal.turnId || proposal.turnId === turn.turnId) {
    return 'Recusado: a proposta foi feita nesta mesma resposta. Mostra-a e espera que ele diga que sim numa mensagem nova (ou carregue em Aprovar no cartão).';
  }
  return null;
}
