import { lisbonTime } from 'src/docs/docs.service';
import { RISK, RISK_ICON } from '../app-update.constants';
import { SpecDoc, UpdateWithAccount } from '../app-update.types';
import { describeChecks, UpdateCheck } from './updateChecks';
import { updateLabel } from './updateFields';

/** A especificação que o utilizador aprova: objetivo, comandos, feito quando, volta atrás, riscos e as regras usadas. */
export function specText(
  update: UpdateWithAccount,
  input: {
    target: string;
    commands: string[];
    donePoints: string[];
    checks: UpdateCheck[];
    steps: { step: string; done: boolean }[];
    specDocs: SpecDoc[];
    rollback?: string;
  },
): string {
  const risk = update.risk as keyof typeof RISK | null;
  return [
    `**Objetivo:** atualizar ${updateLabel(update)} de ${update.fromVersion} para ${update.toVersion} no ${input.target}.`,
    `**Comandos**, por esta ordem:\n\`\`\`bash\n${input.commands.join('\n')}\n\`\`\``,
    `**Feito quando** (verificado no fim, cada um com prova):\n${input.donePoints.map((point) => `- [ ] ${point}`).join('\n') || '- [ ] A versão nova responde'}`,
    `**Se falhar:** ${input.rollback ?? 'o MyHomeLab volta ao snapshot feito antes dos comandos e liga a máquina; a atualização fica em Waiting for reply com o que aconteceu.'}`,
    `**Riscos:** ${risk ? `${RISK_ICON[risk] ?? ''} ${RISK[risk] ?? risk}` : 'por estudar'}${update.reasonsAgainst.length ? ` — ${update.reasonsAgainst.join('; ')}` : ''}`,
    input.steps.length
      ? `**Passos à mão:**\n${input.steps.map((step) => `- [${step.done ? 'x' : ' '}] ${step.step}`).join('\n')}`
      : null,
    `**Verificado antes:**\n${describeChecks(input.checks)}`,
    `**Regras usadas** (a versão de cada uma):\n${input.specDocs.map((doc) => `- ${doc.title} — versão de ${lisbonTime(new Date(doc.updatedAt))}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
