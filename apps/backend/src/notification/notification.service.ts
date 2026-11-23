import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationKind, Prisma } from 'src/generated/prisma/client/client';
import {
  foldUpdateNotices,
  waitingUpdateId,
} from './helpers/foldUpdateNotices';

const RESOLVED_SHOWN = 30;

/** A app de um aviso de app ligada, para o botão abrir a página certa. */
const APP_OF_NOTIFICATION = {
  connectedAccount: { select: { provider: true } },
} as const;

/**
 * A zona de notificações. Uma notificação fica ativa até `resolvedAt`; há no
 * máximo uma ativa por serviço e tipo, para um serviço em baixo não encher a
 * lista a cada verificação.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async open(input: {
    userId: string;
    monitorId: string;
    kind: NotificationKind;
    title: string;
    message: string;
  }): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { monitorId: input.monitorId, kind: input.kind, resolvedAt: null },
    });
    if (existing) {
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: { message: input.message },
      });
      return;
    }
    await this.prisma.notification.create({ data: input });
  }

  async resolve(monitorId: string, kind: NotificationKind): Promise<void> {
    await this.resolveWhere({ monitorId, kind, resolvedAt: null });
  }

  /** Fecha os alertas. */
  private async resolveWhere(where: Prisma.NotificationWhereInput) {
    await this.prisma.notification.updateMany({
      where,
      data: { resolvedAt: new Date() },
    });
  }

  /**
   * Alertas que não são de um serviço (discos, pools, armazenamentos): no máximo
   * um ativo por servidor, assunto e tipo.
   */
  async openForSubject(input: {
    userId: string;
    serverConnectionId: string;
    subject: string;
    kind: NotificationKind;
    title: string;
    message: string;
  }): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        serverConnectionId: input.serverConnectionId,
        subject: input.subject,
        kind: input.kind,
        resolvedAt: null,
      },
    });
    if (existing) {
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: { title: input.title, message: input.message },
      });
      return;
    }
    await this.prisma.notification.create({ data: input });
  }

  /**
   * Alertas de um utilizador que não são de um serviço nem de um servidor (ex: um
   * backup de uma app ligada): no máximo um ativo por assunto e tipo.
   */
  async openUserSubject(input: {
    userId: string;
    subject: string;
    connectedAccountId?: string;
    serverConnectionId?: string;
    kind: NotificationKind;
    title: string;
    message: string;
  }): Promise<void> {
    // Dois crons ao mesmo tempo não criam dois avisos iguais: o bloqueio (até ao fim da
    // transação) põe-nos em fila para o mesmo utilizador, assunto e tipo.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.userId}|${input.subject}|${input.kind}`}))`;
      const existing = await tx.notification.findFirst({
        where: {
          userId: input.userId,
          subject: input.subject,
          kind: input.kind,
          resolvedAt: null,
        },
      });
      if (existing) {
        await tx.notification.update({
          where: { id: existing.id },
          data: { title: input.title, message: input.message },
        });
        return;
      }
      await tx.notification.create({ data: input });
    });
  }

  async resolveUserSubject(
    userId: string,
    subject: string,
    kind: NotificationKind,
  ): Promise<void> {
    await this.resolveWhere({ userId, subject, kind, resolvedAt: null });
  }

  /** Fecha os avisos de um utilizador cujo assunto começa por `prefix`, menos o `keep` (ex: os resumos dos dias antes). */
  async resolveUserSubjectsExcept(
    userId: string,
    prefix: string,
    keep: string,
    kind: NotificationKind,
  ): Promise<void> {
    await this.resolveWhere({
      userId,
      kind,
      resolvedAt: null,
      subject: { startsWith: prefix, not: keep },
    });
  }

  /** Fecha os avisos ativos de um tipo cujo assunto não está na lista (de todos os utilizadores). */
  async resolveKindExcept(
    kind: NotificationKind,
    keep: string[],
  ): Promise<void> {
    await this.resolveWhere({
      kind,
      resolvedAt: null,
      subject: { notIn: keep },
    });
  }

  /** Fecha os avisos de uma app ligada (ex: quando a conta é desligada). */
  async resolveConnectedAccount(connectedAccountId: string): Promise<void> {
    await this.resolveWhere({ connectedAccountId, resolvedAt: null });
  }

  /** Fecha os alertas do servidor e tipo cujo assunto já não está na lista. */
  async resolveSubjectsExcept(
    serverConnectionId: string,
    kind: NotificationKind,
    keep: string[],
  ): Promise<void> {
    await this.resolveWhere({
      serverConnectionId,
      kind,
      resolvedAt: null,
      subject: { notIn: keep },
    });
  }

  async list(userId: string) {
    const [opened, resolved] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        include: APP_OF_NOTIFICATION,
      }),
      this.prisma.notification.findMany({
        where: { userId, resolvedAt: { not: null } },
        orderBy: { resolvedAt: 'desc' },
        take: RESOLVED_SHOWN,
        include: APP_OF_NOTIFICATION,
      }),
    ]);
    return { active: await this.foldActive(opened), resolved };
  }

  async count(userId: string): Promise<{ active: number }> {
    const opened = await this.prisma.notification.findMany({
      where: { userId, resolvedAt: null },
      select: {
        id: true,
        kind: true,
        subject: true,
        connectedAccountId: true,
        serverConnectionId: true,
      },
    });
    return { active: (await this.foldActive(opened)).length };
  }

  /** A pergunta de uma atualização junta o aviso "tem atualização" da mesma app ou servidor. */
  private async foldActive<
    T extends Parameters<typeof foldUpdateNotices>[0][number],
  >(opened: T[]) {
    const ids = opened
      .map((notification) => waitingUpdateId(notification.subject))
      .filter((id): id is string => Boolean(id));
    const targets = ids.length
      ? await this.prisma.appUpdate.findMany({
          where: { id: { in: ids } },
          select: { id: true, accountId: true, hostServerId: true },
        })
      : [];
    return foldUpdateNotices(opened, targets);
  }

  /** "Visto": só os recados (avisos dos agendamentos); os problemas fecham-se sozinhos. */
  async dismiss(userId: string, id: string): Promise<void> {
    await this.resolveWhere({
      id,
      userId,
      kind: NotificationKind.AGENT_NOTICE,
      resolvedAt: null,
    });
  }

  /** Limpa o histórico das resolvidas; as ativas só saem quando o problema passa. */
  async clearResolved(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { userId, resolvedAt: { not: null } },
    });
  }
}
