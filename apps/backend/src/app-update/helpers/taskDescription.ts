import { UpdateWithAccount } from '../app-update.types';
import { afterSection, report, sourcesList } from './reportSections';
import { docUrl } from './updateFields';

/** A descrição da tarefa no quadro: o relatório, a especificação, os detalhes e o link para o registo. */
export function taskDescription(update: UpdateWithAccount) {
  const log = update.logDocId ? docUrl(update.logDocId) : null;
  return [
    ...report(update),
    update.spec ? `## Especificação\n${update.spec}` : null,
    afterSection(update),
    update.study ? `---\n## Detalhes técnicos\n${update.study}` : null,
    sourcesList(update),
    log
      ? `[📒 Registo completo no MyHomeLab](${log}) — o estudo, as decisões, os comandos e o resultado.`
      : null,
    '_Criada pelo MyHomeLab. Study → Ready to update / Waiting for reply / Recheck later → In Progress → Verifying → Done. Podes mudar à mão para Cancelled, Recheck later (o dia é a data de fim), Study, Ready to update ou Waiting for reply._',
  ]
    .filter(Boolean)
    .join('\n\n');
}
