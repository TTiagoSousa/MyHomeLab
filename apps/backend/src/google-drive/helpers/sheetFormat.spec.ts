import { color, sheetFormatRequests } from './sheetFormat';
import { Table } from 'src/chat-file/helpers/sheetTable';

const table: Table = {
  sheet: 'Clientes',
  columns: ['Nome', 'Telefone', 'Estado'],
  headerRow: 1,
  rows: [
    { line: 2, cells: ['Ana', '912', 'Por levantar'] },
    { line: 3, cells: ['Rui', '913', 'Levantado'] },
  ],
};

describe('sheetFormatRequests', () => {
  it('turns the data into a table with typed columns and a dropdown', () => {
    const { requests } = sheetFormatRequests(table, 7, {
      table: { name: 'Clientes CTT' },
      columns: [
        { column: 'Telefone', type: 'text' },
        {
          column: 'Estado',
          type: 'dropdown',
          values: ['Por levantar', 'Levantado'],
        },
      ],
    });
    expect(requests).toEqual([
      {
        addTable: {
          table: {
            name: 'Clientes CTT',
            range: {
              sheetId: 7,
              startRowIndex: 0,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 3,
            },
            columnProperties: [
              { columnIndex: 1, columnName: 'Telefone', columnType: 'TEXT' },
              {
                columnIndex: 2,
                columnName: 'Estado',
                columnType: 'DROPDOWN',
                dataValidationRule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Por levantar' },
                      { userEnteredValue: 'Levantado' },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ]);
  });

  it('without a table uses validation and formats below the header', () => {
    const { requests } = sheetFormatRequests(table, 0, {
      columns: [{ column: 'C', type: 'dropdown', values: ['A', 'B'] }],
      header: { bold: true, background: '#000000' },
      freezeHeader: true,
    });
    expect(requests[0]).toMatchObject({
      setDataValidation: {
        range: { startRowIndex: 1, endRowIndex: 3, startColumnIndex: 2 },
      },
    });
    expect(requests[1]).toMatchObject({
      repeatCell: {
        range: { startRowIndex: 0, endRowIndex: 1 },
        fields:
          'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
      },
    });
    expect(requests[2]).toMatchObject({
      updateSheetProperties: {
        properties: { gridProperties: { frozenRowCount: 1 } },
      },
    });
  });

  it('paints the whole row with a formula on the column', () => {
    const { requests } = sheetFormatRequests(table, 0, {
      highlight: [
        {
          column: 'Estado',
          when: 'equals',
          value: 'Levantado',
          background: '#d4f4dd',
          wholeRow: true,
        },
      ],
    });
    expect(requests[0]).toMatchObject({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ startRowIndex: 1, endRowIndex: 3, endColumnIndex: 3 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$C2="Levantado"' }],
            },
          },
        },
      },
    });
  });

  it('refuses a dropdown without options and a bad colour', () => {
    expect(() =>
      sheetFormatRequests(table, 0, {
        columns: [{ column: 'Estado', type: 'dropdown' }],
      }),
    ).toThrow('faltam as opções');
    expect(() => color('verde')).toThrow('não é uma cor');
  });
});

describe('dropdown option colours', () => {
  it('colours each option with readable text', () => {
    const { requests, done } = sheetFormatRequests(table, 0, {
      table: {},
      columns: [
        {
          column: 'Estado',
          type: 'dropdown',
          values: ['Por levantar', 'Levantado'],
          colors: { Levantado: '#b7e1cd', 'Por levantar': '#990000' },
        },
      ],
    });
    const rules = requests.slice(1) as {
      addConditionalFormatRule: {
        rule: {
          booleanRule: {
            condition: { values: { userEnteredValue: string }[] };
            format: { textFormat: { foregroundColor: { red: number } } };
          };
        };
      };
    }[];
    expect(rules).toHaveLength(2);
    const byValue = Object.fromEntries(
      rules.map(({ addConditionalFormatRule: { rule } }) => [
        rule.booleanRule.condition.values[0].userEnteredValue,
        rule.booleanRule.format.textFormat.foregroundColor.red,
      ]),
    );
    expect(byValue).toEqual({
      Levantado: byValue.Levantado,
      'Por levantar': 1,
    });
    expect(byValue.Levantado).toBeLessThan(0.2);
    expect(done.some((line) => line.includes('«Levantado»'))).toBe(true);
  });
});
