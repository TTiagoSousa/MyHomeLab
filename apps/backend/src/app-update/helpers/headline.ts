import { AppUpdate, AppUpdateStatus } from 'src/generated/prisma/client/client';
import { lisbonTime } from 'src/docs/docs.service';
import { HEADLINE_ICON } from '../app-update.constants';
import { day, now } from './updateDates';

/** A frase grande do relatório: o que se passa agora, sem jargão. */
export function headline(update: AppUpdate): string {
  const icon = HEADLINE_ICON[update.status];
  switch (update.status) {
    case AppUpdateStatus.NEW:
      return `${icon} Versão nova. Põe-na em Espera por estudo para o agente a estudar.`;
    case AppUpdateStatus.STUDY:
      return `${icon} O agente ainda vai estudar esta versão.`;
    case AppUpdateStatus.STUDYING:
      return `${icon} O agente está a estudar esta versão agora.`;
    case AppUpdateStatus.READY:
      return `${icon} Pode atualizar-se${update.updateAfter && update.updateAfter > now() ? ` a partir de ${day(update.updateAfter)}` : ''} — é só pedires ao Jarvis.`;
    case AppUpdateStatus.WAITING:
      return `${icon} Preciso de uma resposta tua: ${update.question ?? '(vê o histórico)'}`;
    case AppUpdateStatus.LATER:
      return `${icon} Para já não. Volto a ver${update.recheckAt ? ` a ${lisbonTime(update.recheckAt)}` : ' mais tarde'}.`;
    case AppUpdateStatus.IN_PROGRESS:
      return `${icon} A atualizar agora.`;
    case AppUpdateStatus.VERIFYING:
      return `${icon} Instalada. Falta confirmar que ficou tudo bem.`;
    case AppUpdateStatus.DONE:
      return `${icon} Atualizada.`;
    case AppUpdateStatus.FAILED:
      return `${icon} A atualização falhou e a máquina voltou ao snapshot.`;
    case AppUpdateStatus.CANCELLED:
      return `${icon} Cancelada.`;
  }
}
