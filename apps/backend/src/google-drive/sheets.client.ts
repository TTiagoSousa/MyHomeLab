import { CellValue, Sheet } from 'src/chat-file/helpers/readWorkbook';
import { GOOGLE_TIMEOUT_MS } from 'src/connected-account/google/google-oauth.client';

/**
 * A API das Folhas do Google (v4): as folhas (separadores) de um ficheiro, ler os valores,
 * mudar células e acrescentar linhas. Escreve como se fosse escrito à mão (USER_ENTERED):
 * "2026-11-19" fica data, "12,5" fica número, "=SOMA(…)" fica fórmula.
 */

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetTab {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

async function call<T>(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const reason =
      (JSON.parse(text || '{}') as { error?: { message?: string } }).error
        ?.message ?? text.slice(0, 200);
    throw new Error(
      response.status === 403
        ? `o Google recusou (${reason}). Confirma que a Sheets API está ativa no projeto do Google Cloud.`
        : `as Folhas do Google responderam ${response.status}: ${reason}`,
    );
  }
  return response.json() as Promise<T>;
}

/** O nome de uma folha numa referência A1 ('Clientes'!A1). */
export const quoteTab = (title: string) => `'${title.replace(/'/g, "''")}'`;

export async function sheetTabs(
  token: string,
  spreadsheetId: string,
): Promise<SheetTab[]> {
  const result = await call<{
    sheets: {
      properties: {
        sheetId: number;
        title: string;
        index: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  }>(
    token,
    `${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))`,
  );
  return result.sheets.map(({ properties }) => ({
    sheetId: properties.sheetId,
    title: properties.title,
    index: properties.index,
    rowCount: properties.gridProperties?.rowCount ?? 0,
    columnCount: properties.gridProperties?.columnCount ?? 0,
  }));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Um número de série das Folhas (dias desde 1899-12-30) como data ISO. */
function serialDate(serial: number): string {
  const date = new Date(Math.round((serial - 25569) * 86_400_000));
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  if (serial < 1) return time;
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return Number.isInteger(serial) ? day : `${day} ${time}`;
}

const looksLikeDate = (text: string) =>
  /^\d{1,4}[/.-]\d{1,2}([/.-]\d{1,4})?(\s+\d{1,2}:\d{2}(:\d{2})?)?$|^\d{1,2}:\d{2}(:\d{2})?$/.test(
    text.trim(),
  );

/**
 * Os valores de uma folha, como uma folha do Excel lida (readWorkbook): números como
 * números, datas como "AAAA-MM-DD", e o número de cada linha. Lê duas vezes (o valor e
 * o texto mostrado), para distinguir uma data de um número.
 */
export async function readTab(
  token: string,
  spreadsheetId: string,
  title: string,
): Promise<Sheet> {
  const range = encodeURIComponent(quoteTab(title));
  const base = `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${range}?majorDimension=ROWS`;
  const [raw, shown] = await Promise.all([
    call<{ values?: (string | number | boolean)[][] }>(
      token,
      `${base}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    ),
    call<{ values?: (string | number | boolean)[][] }>(
      token,
      `${base}&valueRenderOption=FORMATTED_VALUE`,
    ),
  ]);
  const rows: CellValue[][] = [];
  const rowNumbers: number[] = [];
  (raw.values ?? []).forEach((row, index) => {
    const cells = row.map((value, column): CellValue => {
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value === 'number') {
        const text = String(shown.values?.[index]?.[column] ?? '');
        return looksLikeDate(text) ? serialDate(value) : value;
      }
      if (typeof value === 'boolean') return value;
      return String(value);
    });
    if (!cells.some((value) => value !== null)) return;
    rows.push(cells);
    rowNumbers.push(index + 1);
  });
  return { name: title, rows, rowNumbers };
}

/** Muda células: cada uma com a referência A1 ("'Clientes'!D12") e o valor. */
export async function writeCells(
  token: string,
  spreadsheetId: string,
  cells: { range: string; value: string | number | boolean | null }[],
): Promise<number> {
  const result = await call<{ totalUpdatedCells?: number }>(
    token,
    `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: cells.map((cell) => ({
          range: cell.range,
          values: [[cell.value ?? '']],
        })),
      }),
    },
  );
  return result.totalUpdatedCells ?? 0;
}

/** Acrescenta linhas no fim da tabela de uma folha. Devolve o intervalo escrito ("'Clientes'!A42:F45"). */
export async function appendRows(
  token: string,
  spreadsheetId: string,
  title: string,
  rows: (string | number | boolean | null)[][],
): Promise<string> {
  const range = encodeURIComponent(`${quoteTab(title)}!A1`);
  const result = await call<{ updates?: { updatedRange?: string } }>(
    token,
    `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: rows.map((row) => row.map((value) => value ?? '')),
      }),
    },
  );
  return result.updates?.updatedRange ?? '';
}

export async function addTab(
  token: string,
  spreadsheetId: string,
  title: string,
): Promise<void> {
  await call(
    token,
    `${SHEETS}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    },
  );
}

/** Mudanças à folha que não são valores (formatação, menus, tabelas, filtros): os pedidos do batchUpdate. */
export async function formatSheet(
  token: string,
  spreadsheetId: string,
  requests: object[],
): Promise<void> {
  await call(
    token,
    `${SHEETS}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    { method: 'POST', body: JSON.stringify({ requests }) },
  );
}
