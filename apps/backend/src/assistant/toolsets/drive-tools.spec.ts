import { diffWorkbooks } from './drive-tools';
import { driveFileId } from 'src/google-drive/drive.client';

describe('driveFileId', () => {
  it.each([
    [
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0',
      '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    ],
    [
      'https://drive.google.com/drive/folders/0BxYz1234567890abcdef?usp=sharing',
      '0BxYz1234567890abcdef',
    ],
    ['https://drive.google.com/open?id=1qwertyuiopasdfgh', '1qwertyuiopasdfgh'],
    ['1AbCdEfGhIjKlMnOpQrStUv', '1AbCdEfGhIjKlMnOpQrStUv'],
  ])('%s', (input, id) => {
    expect(driveFileId(input)).toBe(id);
  });
});

describe('diffWorkbooks', () => {
  const sheet = (rows: (string | number | null)[][]) => [
    {
      name: 'Clientes',
      rows,
      rowNumbers: rows.map((_, index) => index + 1),
    },
  ];

  it('lists the cells that changed with the column name', () => {
    const before = sheet([
      ['Nome', 'Estado'],
      ['Ana', 'Por levantar'],
      ['Rui', 'Por levantar'],
    ]);
    const after = sheet([
      ['Nome', 'Estado'],
      ['Ana', 'Levantado'],
      ['Rui', 'Por levantar'],
      ['Eva', 'Por levantar'],
    ]);
    expect(diffWorkbooks(before, after)).toEqual([
      '- «Clientes» B2 («Estado»): «Por levantar» → «Levantado»',
      '- «Clientes» A4 («Nome»): «» → «Eva»',
      '- «Clientes» B4 («Estado»): «» → «Por levantar»',
    ]);
  });

  it('says when nothing changed', () => {
    const same = sheet([['Nome'], ['Ana']]);
    expect(diffWorkbooks(same, same)).toEqual([]);
  });
});
