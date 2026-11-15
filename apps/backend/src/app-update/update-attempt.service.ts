import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdate,
  AppUpdateStatus,
  Prisma,
  UpdateAttempt,
  UpdateAttemptKind,
  UpdateAttemptStatus,
  UpdateCheckPhase,
  UpdateCheckState,
} from 'src/generated/prisma/client/client';
import { UpdateCheck } from './helpers/updateChecks';
import { parsePoint } from './helpers/parsePoint';
import { checkTopic } from './helpers/checkTopic';

/** As que ainda estão a andar (uma por atualização). */
const OPEN_ATTEMPT: UpdateAttemptStatus[] = [
  UpdateAttemptStatus.CHECKING,
  UpdateAttemptStatus.RUNNING,
  UpdateAttemptStatus.VERIFYING,
];

/** O estado da atualização → o da tentativa (os que não estão aqui não mudam nada). */
const FOLLOW: Partial<Record<AppUpdateStatus, UpdateAttemptStatus>> = {
  [AppUpdateStatus.IN_PROGRESS]: UpdateAttemptStatus.RUNNING,
  [AppUpdateStatus.VERIFYING]: UpdateAttemptStatus.VERIFYING,
  [AppUpdateStatus.DONE]: UpdateAttemptStatus.DONE,
  [AppUpdateStatus.FAILED]: UpdateAttemptStatus.FAILED,
  [AppUpdateStatus.CANCELLED]: UpdateAttemptStatus.STOPPED,
  [AppUpdateStatus.LATER]: UpdateAttemptStatus.STOPPED,
  [AppUpdateStatus.STUDY]: UpdateAttemptStatus.STOPPED,
};

const FINISHED: UpdateAttemptStatus[] = [
  UpdateAttemptStatus.DONE,
  UpdateAttemptStatus.FAILED,
  UpdateAttemptStatus.STOPPED,
];

const STATE_ICON: Record<UpdateCheckState, string> = {
  PENDING: '⏳ por validar',
  VALIDATED: '✅ validada',
  NOT_VALIDATED: '❌ não validada',
  NOT_APPLICABLE: '➖ não se aplica',
  SKIPPED: '⏭ saltada por pedido direto',
};

export type CheckState =
  'validated' | 'not_validated' | 'not_applicable' | 'skipped';

const STATE_OF: Record<CheckState, UpdateCheckState> = {
  validated: UpdateCheckState.VALIDATED,
  not_validated: UpdateCheckState.NOT_VALIDATED,
  not_applicable: UpdateCheckState.NOT_APPLICABLE,
  skipped: UpdateCheckState.SKIPPED,
};

const measuredState = (check: UpdateCheck) =>
  check.ok === null
    ? UpdateCheckState.NOT_APPLICABLE
    : check.ok
      ? UpdateCheckState.VALIDATED
      : UpdateCheckState.NOT_VALIDATED;

/**
 * A medição dentro do ponto das regras: a prova fica sempre; o estado só quando a
 * medição chega (um salto major fica por validar até ele dizer que sim).
 */
const measuredData = (check: UpdateCheck, now: Date) => {
  const evidence = `Medido pelo MyHomeLab: ${check.evidence}`;
  const needsAnswer = check.ok === false && checkTopic(check.point) === 'major';
  return needsAnswer
    ? { evidence }
    : {
        state: measuredState(check),
        evidence,
        checkedBy: 'MyHomeLab',
        checkedAt: now,
      };
};

type Numbered = Pick<UpdateAttempt, 'updateId' | 'kind' | 'startedAt'>;

/** A quantas instalações vai esta (1.ª, 2.ª…); os estudos não contam (null). */
const installNumberIn = (all: Numbered[], attempt: Numbered) =>
  attempt.kind === UpdateAttemptKind.UPDATE
    ? all.filter(
        (other) =>
          other.updateId === attempt.updateId &&
          other.kind === UpdateAttemptKind.UPDATE &&
          other.startedAt <= attempt.startedAt,
      ).length
    : null;

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

export type AttemptWithChecks = Prisma.UpdateAttemptGetPayload<{
  include: { checks: true };
}>;

const withChecks = { checks: { orderBy: { position: 'asc' as const } } };

interface OpenInput {
  title: string;
  before: string[];
  after: string[];
  measured: UpdateCheck[];
  docs: { id: string; title: string; updatedAt: string }[];
  /** Uma preparação nova: os pontos voltam a "por validar" (a 2.ª chamada não). */
  fresh?: boolean;
  /** Estudo ou atualização: uma tentativa de outro tipo fecha a que estava aberta. */
  kind?: UpdateAttemptKind;
}

/**
 * As tentativas de atualizar: abrem-se quando o agente prepara uma atualização,
 * com os pontos das regras desse momento, e ele vai-os validando um a um. O código
 * só regista: não bloqueia nada nem decide se se avança.
 */
@Injectable()
export class UpdateAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  current(updateId: string): Promise<AttemptWithChecks | null> {
    return this.prisma.updateAttempt.findFirst({
      where: { updateId, status: { in: OPEN_ATTEMPT } },
      include: withChecks,
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * A tentativa em curso, ou uma nova. Uma preparação nova (fresh) fecha a que
   * estava a validar — fica guardada com o que faltou — e abre outra. Na 2.ª chamada
   * a mesma tentativa continua: as medições passam a ter o valor de agora e entram
   * os pontos que as regras ganharam.
   */
  async open(update: AppUpdate, input: OpenInput): Promise<AttemptWithChecks> {
    let current = await this.current(update.id);
    if (current && current.status !== UpdateAttemptStatus.CHECKING)
      return current;
    const kind = input.kind ?? UpdateAttemptKind.UPDATE;
    if (current && (input.fresh || current.kind !== kind)) {
      await this.finish(
        current,
        `Fechada ao abrir a tentativa ${current.number + 1}. ${this.gaps(current)}`,
      );
      current = null;
    }
    const attempt =
      current ??
      (await this.prisma.updateAttempt.create({
        data: {
          userId: update.userId,
          updateId: update.id,
          accountId: update.accountId,
          hostServerId: update.hostServerId,
          number:
            (await this.prisma.updateAttempt.count({
              where: { updateId: update.id },
            })) + 1,
          title: input.title,
          kind,
          fromVersion: update.fromVersion,
          toVersion: update.toVersion,
          docs: input.docs,
        },
        include: withChecks,
      }));

    const rules = [
      ...input.before.map((text) => ({ text, phase: UpdateCheckPhase.BEFORE })),
      ...input.after.map((text) => ({ text, phase: UpdateCheckPhase.AFTER })),
    ];
    const keyOf = (phase: UpdateCheckPhase, point: string) =>
      `${phase}:${normalize(point)}`;
    // Uma medição com um ponto igual nas regras (salto major, backups ativos) entra nesse
    // ponto, em vez de aparecer duas vezes.
    const measuredFor = (rule: (typeof rules)[number]) => {
      const topic =
        rule.phase === UpdateCheckPhase.BEFORE
          ? checkTopic(parsePoint(rule.text).point)
          : null;
      return topic
        ? input.measured.find((check) => checkTopic(check.point) === topic)
        : undefined;
    };
    const absorbed = new Set(
      rules.map(measuredFor).filter((check) => check !== undefined),
    );
    const standalone = input.measured.filter((check) => !absorbed.has(check));
    if (current) {
      // Saem os pontos que já não estão nas regras (nem nas medições).
      const wanted = new Set([
        ...standalone.map((check) =>
          keyOf(UpdateCheckPhase.BEFORE, check.point),
        ),
        ...rules.map((rule) => keyOf(rule.phase, parsePoint(rule.text).point)),
      ]);
      const gone = attempt.checks.filter(
        (check) => !wanted.has(keyOf(check.phase, check.point)),
      );
      if (gone.length) {
        await this.prisma.updateAttemptCheck.deleteMany({
          where: { id: { in: gone.map((check) => check.id) } },
        });
        attempt.checks = attempt.checks.filter(
          (check) => !gone.includes(check),
        );
      }
    }
    const known = new Map(
      attempt.checks.map((check) => [keyOf(check.phase, check.point), check]),
    );
    let position = attempt.checks.reduce(
      (max, check) => Math.max(max, check.position),
      0,
    );
    const now = new Date();

    for (const check of standalone) {
      const existing = known.get(
        `${UpdateCheckPhase.BEFORE}:${normalize(check.point)}`,
      );
      const data = {
        state: measuredState(check),
        evidence: check.evidence,
        checkedBy: 'MyHomeLab',
        checkedAt: now,
      };
      if (existing) {
        await this.prisma.updateAttemptCheck.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.updateAttemptCheck.create({
          data: {
            attemptId: attempt.id,
            position: ++position,
            phase: UpdateCheckPhase.BEFORE,
            point: check.point,
            source: 'MyHomeLab',
            who: 'code',
            ...data,
          },
        });
      }
    }

    for (const rule of rules) {
      const parsed = parsePoint(rule.text);
      const existing = known.get(`${rule.phase}:${normalize(parsed.point)}`);
      const measured = measuredFor(rule);
      const fromMeasure = measured ? measuredData(measured, now) : null;
      if (existing) {
        // O que alguém já marcou à mão não volta para trás com a medição.
        if (
          fromMeasure &&
          (!existing.checkedBy || existing.checkedBy === 'MyHomeLab')
        ) {
          await this.prisma.updateAttemptCheck.update({
            where: { id: existing.id },
            data: fromMeasure,
          });
        }
        continue;
      }
      await this.prisma.updateAttemptCheck.create({
        data: {
          attemptId: attempt.id,
          position: ++position,
          phase: rule.phase,
          point: parsed.point,
          proof: parsed.proof,
          source: parsed.source,
          who: parsed.who,
          ...fromMeasure,
        },
      });
    }
    if (current) {
      await this.prisma.updateAttempt.update({
        where: { id: attempt.id },
        data: { docs: input.docs },
      });
    }
    return (await this.current(update.id))!;
  }

  /** Marca um ponto (pelo número). Devolve o texto para o agente, com o que falta. */
  async mark(
    updateId: string,
    input: { position: number; state: CheckState; evidence: string },
    by: string,
  ): Promise<string> {
    const attempt = await this.current(updateId);
    if (!attempt) {
      return 'Não há nenhuma tentativa aberta: começa com update_prepare (sem checklist), que a abre com os pontos das regras.';
    }
    const check = attempt.checks.find(
      (item) => item.position === input.position,
    );
    if (!check) {
      return `Não há o ponto ${input.position} nesta tentativa. Os pontos são:\n${this.describe(attempt)}`;
    }
    const evidence = input.evidence?.trim();
    if (!evidence)
      return 'Falta a prova (o valor que viste, ou porque não se aplica).';
    await this.prisma.updateAttemptCheck.update({
      where: { id: check.id },
      data: {
        state: STATE_OF[input.state],
        evidence,
        checkedBy: by,
        checkedAt: new Date(),
      },
    });
    const fresh = (await this.current(updateId))!;
    return `Ponto ${check.position} ${STATE_ICON[STATE_OF[input.state]]}.\n\n${this.describe(fresh)}`;
  }

  /** A checklist mandada de uma vez (update_prepare / update_verify): marca pelo texto. */
  async markMany(
    updateId: string,
    phase: UpdateCheckPhase,
    checklist: { point: string; ok: boolean; evidence: string }[],
    by: string,
  ): Promise<void> {
    const attempt = await this.current(updateId);
    if (!attempt) return;
    const now = new Date();
    for (const item of checklist) {
      const wanted = normalize(parsePoint(item.point).point);
      const check = attempt.checks.find(
        (candidate) =>
          candidate.phase === phase &&
          (normalize(candidate.point) === wanted ||
            normalize(candidate.point).startsWith(wanted) ||
            wanted.startsWith(normalize(candidate.point))),
      );
      if (!check) continue;
      const evidence = item.evidence?.trim();
      await this.prisma.updateAttemptCheck.update({
        where: { id: check.id },
        data: {
          state:
            item.ok && evidence
              ? UpdateCheckState.VALIDATED
              : UpdateCheckState.NOT_VALIDATED,
          evidence: evidence || 'sem prova',
          checkedBy: by,
          checkedAt: now,
        },
      });
    }
  }

  /** O agente pára (update_attempt_close): a tentativa fica guardada como falhada, com o porquê. */
  async close(updateId: string, reason: string): Promise<string> {
    const attempt = await this.current(updateId);
    if (!attempt || attempt.status !== UpdateAttemptStatus.CHECKING) {
      return 'Não há nenhuma tentativa a validar para fechar.';
    }
    const why = reason.trim() || 'Sem motivo.';
    await this.finish(attempt, `${why}\n\n${this.gaps(attempt)}`);
    return `Tentativa ${attempt.number} fechada e guardada (falhou: ${why}). A próxima update_prepare abre a tentativa ${attempt.number + 1}.`;
  }

  /** O estudo acabou: a tentativa de estudo fica guardada com a recomendação e o que faltou. */
  async finishStudy(updateId: string, recommendation: string): Promise<void> {
    const attempt = await this.current(updateId);
    if (!attempt || attempt.kind !== UpdateAttemptKind.STUDY) return;
    await this.prisma.updateAttempt.update({
      where: { id: attempt.id },
      data: {
        status: UpdateAttemptStatus.DONE,
        finishedAt: new Date(),
        result: `${recommendation}\n\n${this.gaps(attempt)}`.slice(0, 20_000),
      },
    });
  }

  private async finish(attempt: AttemptWithChecks, result: string) {
    await this.prisma.updateAttempt.update({
      where: { id: attempt.id },
      data: {
        status: UpdateAttemptStatus.FAILED,
        finishedAt: new Date(),
        result: result.slice(0, 20_000),
      },
    });
  }

  /** O que ficou por validar antes de atualizar, em números (os pontos estão na tentativa). */
  private gaps(attempt: AttemptWithChecks): string {
    const before = attempt.checks.filter(
      (check) => check.phase === UpdateCheckPhase.BEFORE,
    );
    const failed = before.filter(
      (check) => check.state === UpdateCheckState.NOT_VALIDATED,
    );
    const pending = before.filter(
      (check) => check.state === UpdateCheckState.PENDING,
    );
    if (!failed.length && !pending.length) return 'Estava tudo validado.';
    const points = (count: number) =>
      count === 1 ? '1 ponto' : `${count} pontos`;
    return `Ficou ${[
      failed.length
        ? `${points(failed.length)} não ${failed.length === 1 ? 'validado' : 'validados'}`
        : '',
      pending.length ? `${points(pending.length)} por validar` : '',
    ]
      .filter(Boolean)
      .join(' e ')}.`;
  }

  /**
   * A atualização mudou de estado: a tentativa em curso acompanha. Uma que pára
   * (reinício, "ver mais tarde", cancelada) guarda o porquê (o evento do histórico).
   */
  async follow(update: AppUpdate, reason?: string): Promise<void> {
    const next = FOLLOW[update.status];
    if (!next) return;
    const attempt = await this.current(update.id);
    if (!attempt || attempt.status === next) return;
    const finished = FINISHED.includes(next);
    await this.prisma.updateAttempt.update({
      where: { id: attempt.id },
      data: {
        status: next,
        ...(finished ? { finishedAt: new Date() } : {}),
        ...(update.result &&
        (next === UpdateAttemptStatus.FAILED ||
          next === UpdateAttemptStatus.DONE)
          ? { result: update.result.slice(0, 20_000) }
          : next === UpdateAttemptStatus.STOPPED && reason && !attempt.result
            ? { result: reason.slice(0, 20_000) }
            : {}),
      },
    });
  }

  /** Para o agente: os pontos numerados e o que falta. */
  describe(attempt: AttemptWithChecks): string {
    const line = (check: AttemptWithChecks['checks'][number]) =>
      `[${check.position}] ${STATE_ICON[check.state]} · ${check.who === 'user' ? '👤 ' : check.who === 'code' ? '📏 ' : '🤖 '}${check.point}` +
      (check.proof ? ` — prova: ${check.proof}` : '') +
      (check.source ? ` (${check.source})` : '') +
      (check.evidence ? `\n    ↳ ${check.evidence}` : '');
    const before = attempt.checks.filter(
      (check) => check.phase === UpdateCheckPhase.BEFORE,
    );
    const after = attempt.checks.filter(
      (check) => check.phase === UpdateCheckPhase.AFTER,
    );
    const count = (items: typeof before) => {
      const validated = items.filter(
        (check) =>
          check.state === UpdateCheckState.VALIDATED ||
          check.state === UpdateCheckState.NOT_APPLICABLE ||
          check.state === UpdateCheckState.SKIPPED,
      ).length;
      return `${validated}/${items.length}`;
    };
    return [
      `TENTATIVA ${attempt.number} (${attempt.id}) · ${attempt.status} · antes ${count(before)} validadas · depois ${count(after)}`,
      'ANTES DE ATUALIZAR:',
      ...(before.length ? before.map(line) : ['(nenhum ponto)']),
      'DEPOIS DE ATUALIZAR (o "feito quando"):',
      ...(after.length ? after.map(line) : ['(nenhum ponto)']),
    ].join('\n');
  }

  // ── Para a página ───────────────────────────────────────────────────────

  async list(
    userId: string,
    filter: { accountId?: string; serverId?: string; limit?: number } = {},
  ) {
    const attempts = await this.prisma.updateAttempt.findMany({
      where: {
        userId,
        ...(filter.accountId ? { accountId: filter.accountId } : {}),
        ...(filter.serverId ? { hostServerId: filter.serverId } : {}),
      },
      include: {
        checks: { select: { phase: true, state: true } },
        account: { select: { provider: true, displayName: true } },
        hostServer: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(filter.limit ?? 50, 200),
    });
    return attempts.map(({ checks, ...attempt }) => ({
      ...attempt,
      installNumber: installNumberIn(attempts, attempt),
      counts: {
        total: checks.length,
        validated: checks.filter(
          (check) => check.state === UpdateCheckState.VALIDATED,
        ).length,
        notValidated: checks.filter(
          (check) => check.state === UpdateCheckState.NOT_VALIDATED,
        ).length,
        notApplicable: checks.filter(
          (check) => check.state === UpdateCheckState.NOT_APPLICABLE,
        ).length,
        skipped: checks.filter(
          (check) => check.state === UpdateCheckState.SKIPPED,
        ).length,
        pending: checks.filter(
          (check) => check.state === UpdateCheckState.PENDING,
        ).length,
      },
    }));
  }

  async get(userId: string, id: string) {
    const attempt = await this.prisma.updateAttempt.findFirst({
      where: { id, userId },
      include: {
        ...withChecks,
        account: { select: { id: true, provider: true, displayName: true } },
        hostServer: { select: { id: true, name: true } },
        update: {
          select: { status: true, logDocId: true, boardTaskKey: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Esta tentativa já não existe.');
    const installs = await this.prisma.updateAttempt.findMany({
      where: { updateId: attempt.updateId, kind: UpdateAttemptKind.UPDATE },
      select: { id: true, updateId: true, kind: true, startedAt: true },
    });
    return { ...attempt, installNumber: installNumberIn(installs, attempt) };
  }
}
