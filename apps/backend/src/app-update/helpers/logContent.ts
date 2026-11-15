import { lisbonTime } from 'src/docs/docs.service';
import { STATUS_NAMES } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { afterSection, report, sourcesList } from './reportSections';
import { appName, historyOf, isHostUpdate } from './updateFields';

const GROUP_NAMES: Record<string, string> = {
  system: 'Sistema',
  addons: 'Add-on',
  hacs: 'HACS',
  firmware: 'Firmware',
  other: 'Integração',
};

/** O que se atualiza, com as versões: a app, a peça do Home Assistant, o Proxmox VE ou os pacotes. */
const updateSubject = (update: UpdateWithAccount) => {
  const versions = `${update.fromVersion} → ${update.toVersion}`;
  if (update.componentTitle) {
    return `${appName(update)} · ${GROUP_NAMES[update.componentGroup ?? 'other'] ?? 'Integração'} ${update.componentTitle} ${versions}`;
  }
  if (isHostUpdate(update)) {
    return update.hostPackages !== null
      ? 'Proxmox · Pacotes do sistema'
      : `Proxmox VE ${versions}`;
  }
  return `${appName(update)} ${versions}`;
};

/** O nome do registo: "Estudo da atualização · Forgejo 15.0.0 → 17.0.1 · HomeLab". */
export function logTitle(update: UpdateWithAccount, server: string | null) {
  return [
    'Estudo da atualização',
    updateSubject(update),
    update.hostServer?.name ?? server,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** O registo (documento LOG): o relatório, os detalhes, as fontes e tudo o que aconteceu. */
export function logContent(update: UpdateWithAccount, server: string | null) {
  const history = historyOf(update);
  return [
    `# ${logTitle(update, server)}`,
    `> Estado: **${STATUS_NAMES[update.status]}**` +
      (update.boardTaskKey ? ` · tarefa ${update.boardTaskKey}` : '') +
      ` · aberta a ${lisbonTime(update.createdAt)}` +
      (update.finishedAt ? ` · acabou a ${lisbonTime(update.finishedAt)}` : ''),
    ...report(update),
    update.spec ? `## Especificação\n${update.spec}` : null,
    afterSection(update),
    update.study ? `## Detalhes técnicos\n${update.study}` : null,
    update.snapshotName ? `## Snapshot\n\`${update.snapshotName}\`` : null,
    sourcesList(update),
    history.length
      ? `## Histórico\n\n${history.map((entry) => `### ${lisbonTime(new Date(entry.at))}\n\n${entry.text}`).join('\n\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}
