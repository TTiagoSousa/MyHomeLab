import { AppUpdate, AppUpdateStatus } from 'src/generated/prisma/client/client';
import { isAvailable } from './updateFields';

/**
 * Saiu uma versão ainda mais nova de uma em aberto. Se ainda está só disponível,
 * fica disponível para a nova;
 * se já foi aberta, volta ao estudo.
 */
export function newerVersion(open: AppUpdate, latest: string) {
  if (isAvailable(open)) {
    return {
      data: {},
      text: `Saiu a versão ${latest}: fica disponível para ela.`,
    };
  }
  return {
    data: {
      status: AppUpdateStatus.STUDY,
      study: null,
      risk: null,
      recommendation: null,
      question: null,
      studyStartedAt: null,
      studiedAt: null,
      studyError: null,
      studyRetries: 0,
      recheckAt: null,
      // O que estava preparado era para a versão antiga: o update_run não o pode usar.
      commands: [],
      spec: null,
      installStartedAt: null,
    },
    text: `Saiu a versão ${latest}: a tarefa passa a ser para ela e volta ao estudo.`,
  };
}
