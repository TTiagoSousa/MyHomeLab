import { RISK } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { day, lisbon } from './updateDates';
import { describeChecks, UpdateCheck } from './updateChecks';
import { afterChecksOf, historyOf, updateLabel } from './updateFields';

/** O estado de uma atualização para o agente (update_status): o resumo, a checklist e o histórico recente. */
export function describeStatus(update: UpdateWithAccount): string {
  const checks = (update.checks as unknown as UpdateCheck[] | null) ?? [];
  return [
    `${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}: ${update.status}` +
      (update.boardTaskKey ? ` (tarefa ${update.boardTaskKey})` : ''),
    update.risk
      ? `Risco: ${RISK[update.risk as keyof typeof RISK] ?? update.risk}. ${update.recommendation ?? ''}`
      : null,
    update.summary ? `Resumo: ${update.summary}` : null,
    update.question ? `Pergunta em aberto: ${update.question}` : null,
    update.recheckAt ? `Volta ao estudo a ${lisbon(update.recheckAt)}.` : null,
    update.updateAfter
      ? `Aconselhado a partir de ${day(update.updateAfter)}.`
      : null,
    update.studyError ? `O último estudo falhou: ${update.studyError}` : null,
    checks.length ? `Checklist:\n${describeChecks(checks)}` : null,
    update.spec ? 'Especificação: no registo (secção Especificação).' : null,
    afterChecksOf(update).length
      ? `Depois de atualizar:\n${describeChecks(afterChecksOf(update))}`
      : null,
    update.snapshotName ? `Snapshot: ${update.snapshotName}` : null,
    update.result ? `Resultado:\n${update.result}` : null,
    historyOf(update).length
      ? `Histórico (o mais recente no fim):\n${historyOf(update)
          .slice(-12)
          .map(
            (entry) =>
              `· ${lisbon(new Date(entry.at))} — ${entry.text.slice(0, 600)}`,
          )
          .join('\n')}`
      : null,
    update.logDocId ? `Registo completo: documento ${update.logDocId}.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
