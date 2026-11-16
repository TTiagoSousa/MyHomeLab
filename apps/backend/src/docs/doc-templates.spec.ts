import { parseTemplate } from './helpers/docTemplates';

describe('parseTemplate', () => {
  it('lê o cabeçalho e o texto', () => {
    const doc = parseTemplate(
      [
        '---',
        'title: Home Assistant – regras',
        'kind: RULES',
        'tags: [home assistant, estudo]',
        'summary: As regras do HA.',
        'apps: [HOME_ASSISTANT, NOPE]',
        'agents: [infra]',
        'server: true',
        '---',
        '# Home Assistant – regras',
        '',
        '## Estudar',
      ].join('\n'),
    );
    expect(doc).toEqual({
      title: 'Home Assistant – regras',
      kind: 'RULES',
      tags: ['home assistant', 'estudo'],
      summary: 'As regras do HA.',
      apps: ['HOME_ASSISTANT'],
      agents: ['infra'],
      server: true,
      content: '# Home Assistant – regras\n\n## Estudar',
    });
  });

  it('recusa um registo ou um ficheiro sem cabeçalho', () => {
    expect(parseTemplate('---\ntitle: X\nkind: LOG\n---\ntexto')).toBeNull();
    expect(parseTemplate('# Só texto')).toBeNull();
  });

  it('aceita comentários no fim da linha do cabeçalho', () => {
    const doc = parseTemplate(
      '---\ntitle: X\nkind: MAP # o que existe\n---\ntexto',
    );
    expect(doc?.kind).toBe('MAP');
  });
});
