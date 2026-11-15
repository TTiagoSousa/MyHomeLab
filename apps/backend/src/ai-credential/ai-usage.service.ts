import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationKind } from 'src/generated/prisma/client/client';

/** O que se gastou numa chamada ao modelo. */
export interface ModelUsage {
  input: number;
  output: number;
  model?: string;
  fresh?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/** Preço aproximado por milhão de tokens, em dólares: entrada, saída, cache lida, cache escrita. */
const PRICES: { match: RegExp; price: [number, number, number, number] }[] = [
  { match: /opus-5-5/i, price: [4, 20, 0.2, 5] },
  { match: /opus/i, price: [5, 25, 0.5, 6.25] },
  { match: /haiku/i, price: [1, 5, 0.1, 1.25] },
  { match: /./, price: [3, 15, 0.3, 3.75] },
];
const EURO_PER_DOLLAR = 0.92;

const lisbonDay = (date = new Date()) =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });

/** O custo estimado (em euros) de uns tokens num modelo. */
export function estimateCost(
  model: string,
  row: {
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    cacheWrite: number;
  },
) {
  const [input, output, read, write] = PRICES.find((item) =>
    item.match.test(model),
  )!.price;
  const dollars =
    (row.tokensIn * input +
      row.tokensOut * output +
      row.cacheRead * read +
      row.cacheWrite * write) /
    1_000_000;
  return dollars * EURO_PER_DOLLAR;
}

/**
 * O consumo da IA: cada chamada ao modelo soma-se por dia, agente e origem (conversa,
 * disparo, estudo…). Com um limite mensal, avisa aos 80% e aos 100% (não trava nada).
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async record(
    userId: string,
    agentKey: string,
    source: string,
    usage: ModelUsage,
  ): Promise<void> {
    const cacheRead = usage.cacheRead ?? 0;
    const cacheWrite = usage.cacheWrite ?? 0;
    const tokensIn =
      usage.fresh ?? Math.max(0, usage.input - cacheRead - cacheWrite);
    const key = {
      userId,
      day: lisbonDay(),
      agentKey,
      model: usage.model ?? 'desconhecido',
      source,
    };
    try {
      await this.prisma.aiUsage.upsert({
        where: { userId_day_agentKey_model_source: key },
        create: {
          ...key,
          tokensIn,
          tokensOut: usage.output,
          cacheRead,
          cacheWrite,
        },
        update: {
          tokensIn: { increment: tokensIn },
          tokensOut: { increment: usage.output },
          cacheRead: { increment: cacheRead },
          cacheWrite: { increment: cacheWrite },
        },
      });
      await this.checkBudget(userId);
    } catch (error) {
      this.logger.warn(
        `Consumo da IA: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** O mês (ex.: "2026-11"): o total, por agente, por origem e por dia, e o limite. */
  async summary(userId: string, month = lisbonDay().slice(0, 7)) {
    const rows = await this.prisma.aiUsage.findMany({
      where: { userId, day: { startsWith: month } },
    });
    const credential = await this.prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
    });
    const group = (key: (row: (typeof rows)[number]) => string) => {
      const map = new Map<
        string,
        {
          key: string;
          tokensIn: number;
          tokensOut: number;
          cacheRead: number;
          cost: number;
        }
      >();
      for (const row of rows) {
        const name = key(row);
        const item = map.get(name) ?? {
          key: name,
          tokensIn: 0,
          tokensOut: 0,
          cacheRead: 0,
          cost: 0,
        };
        item.tokensIn += row.tokensIn + row.cacheWrite;
        item.tokensOut += row.tokensOut;
        item.cacheRead += row.cacheRead;
        item.cost += estimateCost(row.model, row);
        map.set(name, item);
      }
      return [...map.values()].sort((a, b) => b.cost - a.cost);
    };
    const total = rows.reduce(
      (sum, row) => sum + estimateCost(row.model, row),
      0,
    );
    return {
      month,
      total,
      budget: credential?.monthlyBudget ?? null,
      byAgent: group((row) => row.agentKey),
      bySource: group((row) => row.source),
      byDay: group((row) => row.day).sort((a, b) => a.key.localeCompare(b.key)),
    };
  }

  async setBudget(userId: string, budget: number | null) {
    if (
      budget !== null &&
      (!Number.isFinite(budget) || budget <= 0 || budget > 10_000)
    ) {
      throw new BadRequestException(
        'O limite tem de ser um valor em euros, entre 0 e 10 000.',
      );
    }
    const credential = await this.prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
    });
    if (!credential)
      throw new BadRequestException('Guarda primeiro uma chave de IA.');
    await this.prisma.aiCredential.update({
      where: { id: credential.id },
      data: { monthlyBudget: budget, budgetWarnedAt: null },
    });
    return this.summary(userId);
  }

  /** Aos 80% e aos 100% do limite do mês: uma notificação (uma de cada por mês). */
  private async checkBudget(userId: string) {
    const credential = await this.prisma.aiCredential.findFirst({
      where: { userId, isActive: true },
    });
    if (!credential?.monthlyBudget) return;
    const month = lisbonDay().slice(0, 7);
    const { total } = await this.summary(userId, month);
    const level =
      total >= credential.monthlyBudget
        ? 100
        : total >= credential.monthlyBudget * 0.8
          ? 80
          : 0;
    if (!level) return;
    const mark = `${month}:${level}`;
    if (
      credential.budgetWarnedAt === mark ||
      (level === 80 && credential.budgetWarnedAt === `${month}:100`)
    )
      return;
    await this.prisma.aiCredential.update({
      where: { id: credential.id },
      data: { budgetWarnedAt: mark },
    });
    await this.notifications.openUserSubject({
      userId,
      subject: `ai-budget:${month}`,
      kind: NotificationKind.AGENT_NOTICE,
      title:
        level === 100
          ? 'Limite da IA deste mês atingido'
          : 'IA a 80% do limite do mês',
      message: `Este mês já se gastaram cerca de ${total.toFixed(2)} € de ${credential.monthlyBudget.toFixed(2)} €. Os agentes continuam a trabalhar; vê o consumo em Assistente → Definições → IA.`,
    });
  }
}
