import { studyPoints } from './helpers/updateChecks';
import { cleanNotes, rawNotesUrl } from './helpers/linkedNotes';

describe('notas num ficheiro à parte (ex.: Forgejo)', () => {
  it('lê o ficheiro em texto, no Codeberg e no GitHub', () => {
    expect(
      rawNotesUrl(
        'https://codeberg.org/forgejo/forgejo/src/branch/forgejo/release-notes-published/17.0.1.md',
      ),
    ).toBe(
      'https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/release-notes-published/17.0.1.md',
    );
    expect(rawNotesUrl('https://github.com/o/r/blob/main/CHANGES.md')).toBe(
      'https://raw.githubusercontent.com/o/r/main/CHANGES.md',
    );
  });

  it('tira os comentários, encurta os PR e deixa de fora as traduções e as tarefas internas', () => {
    const notes = [
      '## Release notes',
      '<!--URL:https://codeberg.org/forgejo/forgejo-->',
      '- Security bug fixes',
      '  - [PR](https://codeberg.org/forgejo/forgejo/pulls/12782): <!--number 12782 -->corrige o proxy',
      '  - [PR](https://codeberg.org/forgejo/forgejo/pulls/13184) ([backported](https://codeberg.org/forgejo/forgejo/pulls/13196)): fix migrations',
      '- Localization',
      '  - Translations updates',
      '- Included for completeness but not user-facing (chores, etc.)',
      '  - chore: deps',
      '- Bug fixes',
      '  - [PR](https://codeberg.org/forgejo/forgejo/pulls/1): fix push',
    ].join('\n');
    expect(cleanNotes(notes)).toBe(
      [
        '## Release notes',
        '',
        '- Security bug fixes',
        '  - #12782 corrige o proxy',
        '  - #13184 fix migrations',
        '- Bug fixes',
        '  - #1 fix push',
      ].join('\n'),
    );
  });
});

describe('os pontos do estudo nos documentos', () => {
  it('lê as caixas de "As regras do estudo" e não as de "Depois do estudo"', () => {
    const docs = [
      {
        title: 'Forgejo – como estudar uma atualização',
        kind: 'RULES',
        content:
          '## As regras do estudo\n- [ ] Tem benefícios\n## Decidir\n- [ ] não é regra\n## Depois do estudo\n- [ ] Relatório',
      },
    ];
    expect(studyPoints(docs)).toEqual([
      'Tem benefícios (Forgejo – como estudar uma atualização)',
    ]);
  });
});
