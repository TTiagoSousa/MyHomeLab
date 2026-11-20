import { Table, resolveColumn } from 'src/chat-file/helpers/sheetTable';
import { columnLetter } from 'src/chat-file/helpers/readWorkbook';

/**
 * O aspeto de uma folha (cores, negrito, tipos de coluna, menus, tabela, filtros) em
 * pedidos do batchUpdate da API das Folhas. Só mexe na aparência e nas regras das
 * células — nunca nos valores.
 */

export type ColumnKind =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'dropdown'
  | 'checkbox';

export interface SheetFormatInput {
  table?: { name?: string };
  header?: { bold?: boolean; background?: string; textColor?: string };
  freezeHeader?: boolean;
  columns?: {
    column: string;
    type: ColumnKind;
    values?: string[];
    /** A cor de cada opção do menu ("Levantado": "#d4f4dd"). */
    colors?: Record<string, string>;
  }[];
  highlight?: {
    column: string;
    when: 'equals' | 'contains' | 'empty' | 'not_empty';
    value?: string;
    background?: string;
    textColor?: string;
    wholeRow?: boolean;
  }[];
  filter?: boolean;
  borders?: boolean;
  autoResize?: boolean;
}

const NUMBER_FORMAT: Record<string, { type: string; pattern: string }> = {
  text: { type: 'TEXT', pattern: '@' },
  number: { type: 'NUMBER', pattern: '#,##0.##' },
  currency: { type: 'CURRENCY', pattern: '#,##0.00 [$€-816]' },
  percent: { type: 'PERCENT', pattern: '0.0%' },
  date: { type: 'DATE', pattern: 'dd/mm/yyyy' },
  datetime: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm' },
};

const TABLE_TYPE: Record<ColumnKind, string> = {
  text: 'TEXT',
  number: 'DOUBLE',
  currency: 'CURRENCY',
  percent: 'PERCENT',
  date: 'DATE',
  datetime: 'DATE_TIME',
  dropdown: 'DROPDOWN',
  checkbox: 'BOOLEAN',
};

/** "#1f6feb" → { red, green, blue } de 0 a 1. */
export function color(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`«${hex}» não é uma cor (usa #RRGGBB)`);
  const value = parseInt(match[1], 16);
  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}

/** Letra branca num fundo escuro, preta num claro. */
export function readableText(background: string) {
  const { red, green, blue } = color(background);
  return 0.299 * red + 0.587 * green + 0.114 * blue < 0.55
    ? '#ffffff'
    : '#1f2328';
}

const listRule = (values: string[]) => ({
  type: 'ONE_OF_LIST',
  values: values.map((value) => ({ userEnteredValue: value })),
});

/** Os pedidos e, para a resposta, o que cada um faz. */
export function sheetFormatRequests(
  table: Table,
  sheetId: number,
  input: SheetFormatInput,
): { requests: object[]; done: string[] } {
  const header = (table.headerRow ?? 1) - 1;
  const lastRow = Math.max(header + 1, ...table.rows.map((row) => row.line));
  const width = table.columns.length;
  const all = {
    sheetId,
    startRowIndex: header,
    endRowIndex: lastRow,
    startColumnIndex: 0,
    endColumnIndex: width,
  };
  const body = (column: number) => ({
    sheetId,
    startRowIndex: header + 1,
    endRowIndex: Math.max(lastRow, header + 1),
    startColumnIndex: column,
    endColumnIndex: column + 1,
  });
  const requests: object[] = [];
  const done: string[] = [];
  const columns = (input.columns ?? []).map((item) => ({
    ...item,
    index: resolveColumn(table, item.column),
  }));
  for (const item of columns) {
    if (item.type === 'dropdown' && !item.values?.length) {
      throw new Error(
        `a coluna «${table.columns[item.index]}» é um menu: faltam as opções (values)`,
      );
    }
  }
  const label = (index: number) =>
    `«${table.columns[index]}» (${columnLetter(index)})`;

  if (input.table) {
    const name = (input.table.name?.trim() || table.sheet).slice(0, 100);
    requests.push({
      addTable: {
        table: {
          name,
          range: all,
          ...(input.header?.background
            ? {
                rowsProperties: {
                  headerColorStyle: {
                    rgbColor: color(input.header.background),
                  },
                },
              }
            : {}),
          columnProperties: columns.map((item) => ({
            columnIndex: item.index,
            columnName: table.columns[item.index],
            columnType: TABLE_TYPE[item.type],
            ...(item.type === 'dropdown'
              ? { dataValidationRule: { condition: listRule(item.values!) } }
              : {}),
          })),
        },
      },
    });
    done.push(
      `converti ${columnLetter(0)}${header + 1}:${columnLetter(width - 1)}${lastRow} na tabela «${name}» (com filtros e cores alternadas)`,
    );
    for (const item of columns) {
      done.push(
        `${label(item.index)}: ${item.type === 'dropdown' ? `menu com ${item.values!.join(' / ')}` : `tipo ${item.type}`}`,
      );
    }
  } else {
    for (const item of columns) {
      if (item.type === 'dropdown' || item.type === 'checkbox') {
        requests.push({
          setDataValidation: {
            range: body(item.index),
            rule: {
              condition:
                item.type === 'dropdown'
                  ? listRule(item.values!)
                  : { type: 'BOOLEAN' },
              showCustomUi: true,
              strict: false,
            },
          },
        });
        done.push(
          `${label(item.index)}: ${item.type === 'dropdown' ? `menu com ${item.values!.join(' / ')}` : 'caixas de seleção'}`,
        );
      } else {
        requests.push({
          repeatCell: {
            range: body(item.index),
            cell: {
              userEnteredFormat: { numberFormat: NUMBER_FORMAT[item.type] },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
        done.push(`${label(item.index)}: formato ${item.type}`);
      }
    }
  }

  if (input.header) {
    const format: Record<string, unknown> = {};
    const fields: string[] = [];
    if (input.header.bold !== undefined) {
      format.textFormat = {
        bold: input.header.bold,
        ...(input.header.textColor
          ? { foregroundColor: color(input.header.textColor) }
          : {}),
      };
      fields.push('userEnteredFormat.textFormat');
    } else if (input.header.textColor) {
      format.textFormat = { foregroundColor: color(input.header.textColor) };
      fields.push('userEnteredFormat.textFormat.foregroundColor');
    }
    if (input.header.background && !input.table) {
      format.backgroundColor = color(input.header.background);
      fields.push('userEnteredFormat.backgroundColor');
    }
    if (fields.length) {
      requests.push({
        repeatCell: {
          range: { ...all, endRowIndex: header + 1 },
          cell: { userEnteredFormat: format },
          fields: fields.join(','),
        },
      });
    }
    done.push(
      `cabeçalho${input.header.bold ? ' a negrito' : ''}${input.header.background ? ` com fundo ${input.header.background}` : ''}${input.header.textColor ? ` e letra ${input.header.textColor}` : ''}`,
    );
  }

  if (input.freezeHeader) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: header + 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
    done.push('o cabeçalho fica fixo ao descer');
  }

  const optionColors: NonNullable<SheetFormatInput['highlight']> = (
    input.columns ?? []
  ).flatMap((item) =>
    Object.entries(item.colors ?? {}).map(([value, background]) => ({
      column: item.column,
      when: 'equals' as const,
      value,
      background,
      textColor: readableText(background),
    })),
  );
  for (const rule of [...optionColors, ...(input.highlight ?? [])]) {
    const index = resolveColumn(table, rule.column);
    if ((rule.when === 'equals' || rule.when === 'contains') && !rule.value) {
      throw new Error(`falta o valor para destacar em ${label(index)}`);
    }
    if (!rule.background && !rule.textColor) {
      throw new Error(`falta a cor para destacar em ${label(index)}`);
    }
    if (rule.wholeRow && rule.when === 'contains') {
      throw new Error(
        'para pintar a linha inteira usa equals, empty ou not_empty (contains só pinta a célula)',
      );
    }
    const cell = `$${columnLetter(index)}${header + 2}`;
    const text = (rule.value ?? '').replace(/"/g, '""');
    const condition = rule.wholeRow
      ? {
          type: 'CUSTOM_FORMULA',
          values: [
            {
              userEnteredValue:
                rule.when === 'equals'
                  ? `=${cell}="${text}"`
                  : rule.when === 'empty'
                    ? `=${cell}=""`
                    : `=${cell}<>""`,
            },
          ],
        }
      : {
          type: {
            equals: 'TEXT_EQ',
            contains: 'TEXT_CONTAINS',
            empty: 'BLANK',
            not_empty: 'NOT_BLANK',
          }[rule.when],
          ...(rule.value ? { values: [{ userEnteredValue: rule.value }] } : {}),
        };
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [
            rule.wholeRow ? { ...all, startRowIndex: header + 1 } : body(index),
          ],
          booleanRule: {
            condition,
            format: {
              ...(rule.background
                ? { backgroundColor: color(rule.background) }
                : {}),
              ...(rule.textColor
                ? { textFormat: { foregroundColor: color(rule.textColor) } }
                : {}),
            },
          },
        },
      },
    });
    const what = {
      equals: `for «${rule.value}»`,
      contains: `tiver «${rule.value}»`,
      empty: 'estiver vazia',
      not_empty: 'não estiver vazia',
    }[rule.when];
    done.push(
      `${rule.wholeRow ? 'a linha' : 'a célula'} pinta-se quando ${label(index)} ${what}`,
    );
  }

  if (input.filter && !input.table) {
    requests.push({ setBasicFilter: { filter: { range: all } } });
    done.push('filtros no cabeçalho');
  }

  if (input.borders) {
    const line = { style: 'SOLID', color: color('#c8ccd2') };
    requests.push({
      updateBorders: {
        range: all,
        top: line,
        bottom: line,
        left: line,
        right: line,
        innerHorizontal: line,
        innerVertical: line,
      },
    });
    done.push('bordas finas em todas as células');
  }

  if (input.autoResize) {
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: width,
        },
      },
    });
    done.push('a largura das colunas ajustada ao conteúdo');
  }

  return { requests, done };
}
