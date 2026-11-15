import { checkTopic } from './checkTopic';

describe('o assunto de um ponto', () => {
  it.each([
    ['Salto de versão major', 'major'],
    ['**Salto de versão major** (ex.: 12 → 13): eu disse que sim', 'major'],
    ['Se é um salto de versão major, eu disse que sim', 'major'],
    [
      'Os backups do MyHomeLab desta app estão ativos e já correram bem',
      'backup',
    ],
    ['**Os backups do Forgejo estão ativos** (list_backups)', 'backup'],
    [
      'Há um backup do Forgejo feito pelo MyHomeLab **há menos de 1 hora**',
      null,
    ],
    ['Não há CI a correr', null],
  ])('"%s" → %s', (point, topic) => {
    expect(checkTopic(point)).toBe(topic);
  });
});
