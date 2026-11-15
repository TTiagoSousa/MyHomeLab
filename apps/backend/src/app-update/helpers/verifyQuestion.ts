import { UpdateWithAccount } from '../app-update.types';
import { updateLabel } from './updateFields';

/** A pergunta de uma verificação que não acabou bem (fica em Waiting for reply). */
export const verifyQuestion = (update: UpdateWithAccount, why: string) =>
  `Instalei ${updateLabel(update)} ${update.toVersion}, mas a verificação não fechou: ${why.slice(0, 600)} ` +
  'Escolhe: Verifying (verifico outra vez), Done (fica assim) ou Cancelled; ou diz-me o que corrigir.';
