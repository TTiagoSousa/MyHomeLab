/** O que o MyHomeLab também mede, para um ponto das regras não aparecer em dobro. */
export type CheckTopic = 'major' | 'backup';

/** O assunto de um ponto: o salto de versão major, os backups ativos, ou nenhum. */
export function checkTopic(point: string): CheckTopic | null {
  const text = point.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/salto de versao major/.test(text)) return 'major';
  if (/backups?\b.*\bativos?\b/.test(text)) return 'backup';
  return null;
}
