import { AppUpdate } from 'src/generated/prisma/client/client';
import { RISK, RISK_ICON } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { headline } from './headline';
import { describeChecks } from './updateChecks';
import { afterChecksOf, sourcesOf, updateLabel } from './updateFields';

/** O relatório para pessoas: o que se passa, em poucas palavras, porque sim e porque não. */
export function report(update: UpdateWithAccount): string[] {
  const risk = update.risk as keyof typeof RISK | null;
  return [
    `**${updateLabel(update)}**: ${update.fromVersion} → ${update.toVersion}` +
      (risk ? ` · risco ${RISK_ICON[risk] ?? ''} ${RISK[risk] ?? risk}` : ''),
    `### ${headline(update)}`,
    update.summary ? `## Em poucas palavras\n${update.summary}` : null,
    update.reasonsFor.length
      ? `## Porque atualizar\n${update.reasonsFor.map((item) => `- ${item}`).join('\n')}`
      : null,
    update.reasonsAgainst.length
      ? `## Porque esperar\n${update.reasonsAgainst.map((item) => `- ${item}`).join('\n')}`
      : null,
    update.manualSteps.length
      ? `## Passos à mão\n${update.manualSteps.map((item) => `- [ ] ${item}`).join('\n')}`
      : null,
    update.recommendation
      ? `## O que aconselho\n${update.recommendation}`
      : null,
  ].filter((part): part is string => Boolean(part));
}

export function afterSection(update: AppUpdate): string | null {
  const checks = afterChecksOf(update);
  return checks.length
    ? `## Depois de atualizar\n${describeChecks(checks)}`
    : null;
}

export function sourcesList(update: AppUpdate): string | null {
  const sources = [
    ...(update.releaseUrl
      ? [{ title: 'Notas da versão', url: update.releaseUrl }]
      : []),
    ...sourcesOf(update).filter((source) => source.url !== update.releaseUrl),
  ];
  return sources.length
    ? `## Fontes\n${sources.map((source) => `- [${source.title}](${source.url})`).join('\n')}`
    : null;
}
