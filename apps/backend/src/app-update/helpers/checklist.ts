import { PENDING_EVIDENCE } from '../app-update.constants';
import { describeChecks, UpdateCheck } from './updateChecks';

/** O que o agente respondeu a cada ponto (sem prova fica marcado como tal). */
export function agentChecks(
  checklist: { point: string; ok: boolean; evidence: string }[],
): UpdateCheck[] {
  return checklist.map((item) => ({
    point: item.point.trim(),
    ok: Boolean(item.ok) && Boolean(item.evidence?.trim()),
    evidence: item.evidence?.trim() || (item.ok ? 'sem prova' : ''),
    source: 'agent',
  }));
}

export function specDocsOf(
  docs: { id: string; title: string; updatedAt: Date }[],
) {
  return docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

/** Para o agente ver de relance o que ficou por validar ou não passou (não bloqueia). */
export function checklistGaps(checks: UpdateCheck[]): string {
  const pending = checks.filter((check) => check.evidence === PENDING_EVIDENCE);
  const failed = checks.filter(
    (check) => check.ok === false && check.evidence !== PENDING_EVIDENCE,
  );
  return (
    (pending.length ? ` Ficaram ${pending.length} pontos por validar.` : '') +
    (failed.length ? ` Não validados:\n${describeChecks(failed)}` : '')
  );
}
