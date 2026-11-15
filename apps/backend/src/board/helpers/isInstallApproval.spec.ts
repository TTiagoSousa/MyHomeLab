import { isInstallApproval } from './isInstallApproval';

describe('isInstallApproval', () => {
  it('aceita só uma aprovação, sem mais nada', () => {
    for (const text of [
      'sim',
      'Sim!',
      'SIM, instala.',
      'podes instalar',
      'Autorizo',
      'ok',
      'instala já',
    ])
      expect(isInstallApproval(text)).toBe(true);
  });

  it('recusa condições, perguntas e outras respostas', () => {
    for (const text of [
      'sim, mas só amanhã',
      'sim às 22:30',
      'não',
      'podes instalar?',
      'instala depois do backup',
      'b',
      '',
    ])
      expect(isInstallApproval(text)).toBe(false);
  });
});
