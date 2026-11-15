import { tokenExpiry, versionIn } from './opengym.client';
import { jsonLiteral, searchCatalog, OpenGymExercise } from './opengymCatalog';

describe('o catálogo do openGym', () => {
  const list: OpenGymExercise[] = [
    {
      id: '0025',
      n: 'barbell bench press',
      bp: 'chest',
      eq: 'barbell',
      tg: 'pectorals',
      pt: 'supino com barra',
    },
    {
      id: '1197',
      n: 'squat',
      bp: 'upper legs',
      eq: 'body weight',
      tg: 'quads',
      pt: 'agachamento',
    },
  ];

  it('lê o formato novo (JSON.parse com aspas e escapes)', () => {
    const source = String.raw`export const EXDB=JSON.parse('[{"id":"1","n":"it\'s a \\\\ test"}]')
export const EXALIAS=JSON.parse('{}')`;
    expect(jsonLiteral(source, 'EXDB')).toEqual([
      { id: '1', n: "it's a \\ test" },
    ]);
  });

  it('lê o formato antigo (o array em JSON puro)', () => {
    const source = `// gerado\nexport const EXDB=[{"id":"1","n":"a"}]\nexport const EXALIAS={"2":"3"}`;
    expect(jsonLiteral(source, 'EXDB')).toEqual([{ id: '1', n: 'a' }]);
    expect(jsonLiteral(source, 'EXALIAS')).toEqual({ '2': '3' });
  });

  it('procura em português e em inglês, sem acentos, e filtra', () => {
    expect(searchCatalog(list, { query: 'supino' }).map((e) => e.id)).toEqual([
      '0025',
    ]);
    expect(searchCatalog(list, { query: 'BENCH' }).map((e) => e.id)).toEqual([
      '0025',
    ]);
    expect(
      searchCatalog(list, { bodyPart: 'upper legs' }).map((e) => e.id),
    ).toEqual(['1197']);
    expect(
      searchCatalog(list, { query: 'squat', equipment: 'barbell' }),
    ).toEqual([]);
  });
});

describe('o token do openGym', () => {
  it('tira a validade do próprio token', () => {
    expect(tokenExpiry('uid123:1767225600000:1.abcdef')?.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(tokenExpiry('sem-formato')).toBeNull();
  });
});

describe('a versão do openGym na página', () => {
  it('lê o "openGym v" das Definições e o "Sobre"', () => {
    expect(versionIn('children:[`openGym v`,`1.4.4`,` · `]')).toBe('1.4.4');
    expect(versionIn('title:z(`Version`),value:`v1.4.2`}')).toBe('1.4.2');
    expect(versionIn('children:[`openGym v`,`1.5.0+abc12`]')).toBe('1.5.0');
    expect(versionIn('nada aqui')).toBeNull();
  });
});
