import { AppUpdate, AppUpdateStatus } from 'src/generated/prisma/client/client';
import { BoardLink } from '../task-board/taskBoard';
import { UpdateWithAccount } from '../app-update.types';
import { day } from './updateDates';
import { docUrl, sourcesOf, updateLabel } from './updateFields';

export function taskTitle(update: UpdateWithAccount) {
  if (update.hostPackages !== null) {
    return `Atualizar os pacotes do sistema do ${update.hostServer?.name ?? 'servidor'} (${update.hostPackages}, Proxmox VE ${update.toVersion})`;
  }
  return `Atualizar ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}`;
}

/** As datas da tarefa: começa quando abriu; o fim é quando volta a ver, quando se aconselha ou quando acabou. */
export function taskDates(update: AppUpdate) {
  const target =
    update.finishedAt ??
    (update.status === AppUpdateStatus.LATER ? update.recheckAt : null) ??
    update.updateAfter;
  return {
    startDate: day(update.createdAt),
    targetDate: target ? day(target) : null,
  };
}

export function taskLinks(update: UpdateWithAccount): BoardLink[] {
  const log = update.logDocId ? docUrl(update.logDocId) : null;
  return [
    ...(log ? [{ title: '📒 Registo no MyHomeLab', url: log }] : []),
    ...(update.releaseUrl
      ? [
          {
            title: `Notas da versão ${update.toVersion}`,
            url: update.releaseUrl,
          },
        ]
      : []),
    ...sourcesOf(update),
  ];
}
