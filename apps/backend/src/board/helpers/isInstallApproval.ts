const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.!,;:\s]+/g, ' ')
    .trim();

/** As respostas que, sozinhas, são o "Sim, instalar" (sem condições nem mais nada). */
const APPROVALS = new Set([
  'sim',
  'sim instala',
  'sim instalar',
  'sim podes instalar',
  'sim pode instalar',
  'sim instala ja',
  'ok',
  'ok instala',
  'ok podes instalar',
  'autorizo',
  'aprovo',
  'instala',
  'instala ja',
  'instalar',
  'podes instalar',
  'pode instalar',
  'podes instalar ja',
  'avanca',
  'pode avancar',
  'podes avancar',
]);

/**
 * Se o comentário dele é só uma aprovação ("sim", "podes instalar", "autorizo"…).
 * Qualquer coisa a mais (uma condição, uma hora, uma pergunta) não conta: vai ao
 * agente como um comentário normal.
 */
export const isInstallApproval = (text: string) => APPROVALS.has(fold(text));
