import { Injectable } from '@nestjs/common';

export interface PromptProposal {
  id: string;
  /** De quem é a proposta — cada utilizador só vê e aplica as suas. */
  userId: string;
  agentKey: string;
  agentName: string;
  /** O prompt que passa a valer. Null significa apagar as instruções. */
  nextPrompt: string | null;
  /** O que lá estava, para se poder mostrar a diferença e para desfazer. */
  previousPrompt: string | null;
  /** A volta de conversa em que a proposta nasceu. É isto que trava o agente. */
  turnId: string;
  createdAt: Date;
}

/**
 * Guarda as alterações de prompt que o agente principal propôs e que ainda
 * esperam pelo "sim" do utilizador.
 *
 * O ponto todo está no `turnId`. Uma proposta e a sua aplicação não podem
 * acontecer na mesma volta de conversa: o agente propõe, a volta acaba, e só
 * uma mensagem nova — escrita por uma pessoa — pode desbloquear a aplicação.
 * Sem isto, "pede autorização primeiro" seria só uma frase no prompt, que o
 * modelo pode ignorar; assim é o código que recusa.
 *
 * Em memória de propósito: uma proposta por confirmar é estado de conversa, não
 * do domínio, e não faz sentido sobreviver a um reinício — o utilizador confirma
 * segundos depois, ou nunca. Só é correto porque corre um único backend.
 */
@Injectable()
export class AgentPromptProposalService {
  private readonly proposals = new Map<string, PromptProposal>();

  // Uma proposta esquecida não deve poder ser aplicada meia hora depois, quando
  // já ninguém se lembra do que era.
  private static readonly TTL_MS = 15 * 60 * 1000;

  create(input: Omit<PromptProposal, 'id' | 'createdAt'>): PromptProposal {
    this.sweep();

    // Uma proposta nova para o mesmo agente substitui a anterior: ter duas em
    // aberto para o mesmo sítio só dava confusão sobre qual o "sim" confirma.
    for (const [id, existing] of this.proposals) {
      if (
        existing.userId === input.userId &&
        existing.agentKey === input.agentKey
      ) {
        this.proposals.delete(id);
      }
    }

    const proposal: PromptProposal = {
      ...input,
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: new Date(),
    };

    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  find(id: string, userId: string): PromptProposal | null {
    this.sweep();
    const proposal = this.proposals.get(id.trim().toUpperCase());
    return proposal && proposal.userId === userId ? proposal : null;
  }

  list(userId: string): PromptProposal[] {
    this.sweep();
    return [...this.proposals.values()].filter(
      (proposal) => proposal.userId === userId,
    );
  }

  discard(id: string): boolean {
    return this.proposals.delete(id.trim().toUpperCase());
  }

  /**
   * Diz se uma proposta já pode ser aplicada. Devolve o motivo em vez de um
   * booleano seco, porque esse motivo vai direto para o modelo explicar ao utilizador.
   */
  authorise(
    id: string,
    turnId: string,
    userId: string,
  ): { ok: true; proposal: PromptProposal } | { ok: false; reason: string } {
    const proposal = this.find(id, userId);

    if (!proposal) {
      return {
        ok: false,
        reason:
          'Não existe nenhuma proposta com esse código. Ou já foi aplicada, ou ' +
          'foi descartada, ou passaram mais de 15 minutos e caducou.',
      };
    }

    if (proposal.turnId === turnId) {
      return {
        ok: false,
        reason:
          'A proposta acabou de ser criada nesta mesma resposta e ainda não foi ' +
          'autorizada. Apresenta-a ao utilizador, espera que ele responda, e só depois ' +
          'aplica — na mensagem seguinte.',
      };
    }

    return { ok: true, proposal };
  }

  private sweep(): void {
    const cutoff = Date.now() - AgentPromptProposalService.TTL_MS;
    for (const [id, proposal] of this.proposals) {
      if (proposal.createdAt.getTime() < cutoff) this.proposals.delete(id);
    }
  }
}
