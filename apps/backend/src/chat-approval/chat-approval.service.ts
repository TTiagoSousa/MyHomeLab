import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ChatApproval,
  ChatApprovalKind,
  ChatApprovalStatus,
  Prisma,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { PrismaAgentRepository } from 'src/agent/repositories/prisma/prisma-agent-repository';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { sendEmailDraft } from 'src/assistant/tools/emailMessages';
import { applyAgentChange } from 'src/assistant/tools/manageTeam';
import type {
  AgentChangePayload,
  EmailSendPayload,
  UpdateInstallPayload,
} from './chat-approval.types';
import { chatDecisionBlock } from './helpers/chatDecisionBlock';

type Payload = EmailSendPayload | AgentChangePayload | UpdateInstallPayload;

/**
 * O que um agente quer fazer e só acontece com o sim do utilizador: enviar um email,
 * mudar a equipa, instalar uma atualização. Fica um cartão no chat com [Aprovar]
 * [Recusar]; o Jarvis só decide por ele quando ele o diz numa mensagem nova da mesma
 * conversa (approval_decide). Num disparo não há cartão: estas ações são recusadas.
 */
@Injectable()
export class ChatApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectedAccounts: PrismaConnectedAccountRepository,
    private readonly agents: PrismaAgentRepository,
    private readonly updates: AppUpdateService,
  ) {}

  /** Uma proposta nova; uma igual por decidir na mesma conversa é substituída. */
  async create(
    userId: string,
    kind: ChatApprovalKind,
    proposedBy: string,
    payload: Payload,
    chat: { conversationId: string; turnId: string },
    sameAs?: (payload: Prisma.JsonValue) => boolean,
  ): Promise<ChatApproval> {
    if (sameAs) {
      const open = await this.prisma.chatApproval.findMany({
        where: {
          userId,
          kind,
          status: ChatApprovalStatus.PENDING,
          conversationId: chat.conversationId,
        },
      });
      const replaced = open.filter((row) => sameAs(row.payload));
      if (replaced.length) {
        await this.prisma.chatApproval.updateMany({
          where: { id: { in: replaced.map((row) => row.id) } },
          data: {
            status: ChatApprovalStatus.REJECTED,
            result: 'Substituída por uma proposta nova.',
            decidedAt: new Date(),
          },
        });
      }
    }
    return this.prisma.chatApproval.create({
      data: {
        userId,
        kind,
        proposedBy,
        payload: payload as unknown as Prisma.InputJsonValue,
        conversationId: chat.conversationId,
        turnId: chat.turnId,
      },
    });
  }

  /** As por decidir (de uma conversa, para os cartões do chat). */
  pending(userId: string, conversationId?: string) {
    return this.prisma.chatApproval.findMany({
      where: {
        userId,
        status: ChatApprovalStatus.PENDING,
        ...(conversationId ? { conversationId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** As por decidir de uma conversa, numa linha cada, para o Jarvis saber que existem. */
  async describePending(userId: string, conversationId: string) {
    const rows = await this.pending(userId, conversationId);
    return rows.map((row) => `- ${row.id}: ${describe(row)}`).join('\n');
  }

  /** Ele carregou em Aprovar no cartão. */
  async approve(userId: string, id: string) {
    const approval = await this.findPending(userId, id);
    return this.execute(approval);
  }

  /** Ele carregou em Recusar no cartão. */
  async reject(userId: string, id: string) {
    const approval = await this.findPending(userId, id);
    return this.prisma.chatApproval.update({
      where: { id: approval.id },
      data: {
        status: ChatApprovalStatus.REJECTED,
        decidedAt: new Date(),
        result: 'Recusada.',
      },
    });
  }

  /** O Jarvis decide porque ele o disse no chat (approval_decide). */
  async decideFromChat(
    userId: string,
    id: string,
    decision: 'approve' | 'reject',
    turn: {
      source?: string;
      depth?: number;
      conversationId?: string;
      turnId: string;
    },
  ): Promise<string> {
    const approval = await this.prisma.chatApproval.findFirst({
      where: { id: id.trim(), userId },
    });
    if (!approval) return 'Não há nenhuma proposta com esse id.';
    const blocked = chatDecisionBlock(approval, turn);
    if (blocked) return blocked;
    if (decision === 'reject') {
      await this.reject(userId, approval.id);
      return `Recusada: ${describe(approval)}.`;
    }
    const done = await this.execute(approval);
    return done.status === ChatApprovalStatus.APPROVED
      ? `Feito: ${done.result}`
      : `Não deu: ${done.result}`;
  }

  private async findPending(userId: string, id: string) {
    const approval = await this.prisma.chatApproval.findFirst({
      where: { id, userId, status: ChatApprovalStatus.PENDING },
    });
    if (!approval) {
      throw new NotFoundException('Esta proposta já não está por decidir');
    }
    return approval;
  }

  private async execute(approval: ChatApproval) {
    // Marca primeiro: dois cliques (ou o cartão e o chat ao mesmo tempo) não enviam duas vezes.
    const claimed = await this.prisma.chatApproval.updateMany({
      where: { id: approval.id, status: ChatApprovalStatus.PENDING },
      data: { status: ChatApprovalStatus.APPROVED, decidedAt: new Date() },
    });
    if (!claimed.count) {
      throw new NotFoundException('Esta proposta já não está por decidir');
    }
    let status: ChatApprovalStatus = ChatApprovalStatus.APPROVED;
    let result: string;
    try {
      result = await this.run(approval);
      if (/^(Não deu|Não há|Esse rascunho já não existe)/.test(result)) {
        status = ChatApprovalStatus.FAILED;
      }
    } catch (error) {
      status = ChatApprovalStatus.FAILED;
      result = error instanceof Error ? error.message : String(error);
    }
    return this.prisma.chatApproval.update({
      where: { id: approval.id },
      data: { status, result },
    });
  }

  private async run(approval: ChatApproval): Promise<string> {
    const { userId } = approval;
    if (approval.kind === ChatApprovalKind.EMAIL_SEND) {
      const email = approval.payload as unknown as EmailSendPayload;
      return sendEmailDraft(
        { accountEmail: email.accountEmail, draftId: email.draftId },
        this.connectedAccounts,
        userId,
      );
    }
    if (approval.kind === ChatApprovalKind.AGENT_CHANGE) {
      const team = await this.agents.findTeam(userId);
      return applyAgentChange(
        approval.payload as unknown as AgentChangePayload,
        { userId, team, agentRepository: this.agents },
      );
    }
    const install = approval.payload as unknown as UpdateInstallPayload;
    const update = await this.updates.get(userId, install.updateId);
    return this.updates.setStatus(update, 'todo', install.comment);
  }
}

/** A proposta numa linha (para o Jarvis e para as respostas das ferramentas). */
function describe(approval: ChatApproval): string {
  if (approval.kind === ChatApprovalKind.EMAIL_SEND) {
    const email = approval.payload as unknown as EmailSendPayload;
    return `enviar o email "${email.subject}" para ${email.to}`;
  }
  if (approval.kind === ChatApprovalKind.AGENT_CHANGE) {
    const change = approval.payload as unknown as AgentChangePayload;
    const verb = { create: 'criar', update: 'mudar', delete: 'apagar' }[
      change.action
    ];
    return `${verb} o agente "${change.agentName}"`;
  }
  const install = approval.payload as unknown as UpdateInstallPayload;
  return `instalar ${install.label}`;
}
