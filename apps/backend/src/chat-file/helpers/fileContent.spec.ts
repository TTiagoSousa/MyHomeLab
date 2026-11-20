import { readCsv, readWorkbook } from './readWorkbook';
import { toNumber, toTable, profile } from './sheetTable';
import { queryTable } from './queryTable';
import { docxMarkdown } from './docxMarkdown';
import { describeTables, kindOf } from './fileContent';

/** Um zip sem compressão (o leitor não confirma o CRC), para montar .xlsx e .docx nos testes. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const workbook = () =>
  zip({
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="Contactos" sheetId="1" r:id="rId2"/><sheet name="Notas" sheetId="2" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/styles.xml':
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    'xl/sharedStrings.xml':
      '<sst><si><t>Nome</t></si><si><t>Email</t></si><si><t>Valor</t></si><si><t>Data</t></si><si><r><t>Jo</t></r><r><t>ão &amp; Cª</t></r></si><si><t>joao@x.pt</t></si><si><t>Ana</t></si><si><t>ana@x.pt</t></si></sst>',
    'xl/worksheets/sheet2.xml':
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2"><v>10.5</v></c><c r="D2" s="1"><v>46345</v></c></row>' +
      '<row r="4"><c r="A4" t="s"><v>6</v></c><c r="B4" t="s"><v>7</v></c><c r="C4"><v>4.5</v></c></row>' +
      '<row r="5"><c r="A5" t="s"><v>6</v></c><c r="B5" t="inlineStr"><is><t>ANA@x.pt</t></is></c><c r="C5" t="str"><v>1.000,25 €</v></c></row>' +
      '</sheetData></worksheet>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetData><row r="1"><c r="B1" t="b"><v>1</v></c></row></sheetData></worksheet>',
  });

describe('readWorkbook', () => {
  it('reads sheets in workbook order, with cells in their columns, dates and rich text', () => {
    const sheets = readWorkbook(workbook());
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Contactos', 'Notas']);
    const [contacts, notes] = sheets;
    expect(contacts.rowNumbers).toEqual([1, 2, 4, 5]);
    expect(contacts.rows[1]).toEqual([
      'João & Cª',
      'joao@x.pt',
      10.5,
      '2026-11-19',
    ]);
    expect(notes.rows[0]).toEqual([null, true]);
  });
});

describe('toTable + queryTable', () => {
  const table = toTable(readWorkbook(workbook())[0]);

  it('finds the header and keeps the Excel line numbers', () => {
    expect(table.columns).toEqual(['Nome', 'Email', 'Valor', 'Data']);
    expect(table.headerRow).toBe(1);
    expect(table.rows.map((row) => row.line)).toEqual([2, 4, 5]);
  });

  it('sums numbers written in any format', () => {
    expect(
      queryTable(table, { aggregates: [{ fn: 'sum', column: 'valor' }] }),
    ).toContain('1015.25');
  });

  it('groups and counts', () => {
    const result = queryTable(table, {
      groupBy: ['Nome'],
      aggregates: [{ fn: 'count' }],
    });
    expect(result).toContain('Ana | 2');
    expect(result).toContain('João & Cª | 1');
  });

  it('finds duplicates ignoring case', () => {
    expect(queryTable(table, { duplicatesBy: ['email'] })).toContain(
      '2 vezes (linhas 4, 5)',
    );
  });

  it('filters by number and by column letter', () => {
    const result = queryTable(table, {
      where: [{ column: 'C', op: '>', value: 5 }],
    });
    expect(result).toContain('2 de 3 linhas');
    expect(result).not.toContain('\n4 |');
  });

  it('explains a missing column', () => {
    expect(() =>
      queryTable(table, { where: [{ column: 'Telefone', op: 'empty' }] }),
    ).toThrow(/Valor/);
  });

  it('profiles the columns', () => {
    expect(profile(table).join('\n')).toMatch(
      /C «Valor»: número \(3\/3 preenchidas.*soma 1015.25/,
    );
    expect(describeTables([table])).toContain('3 linhas de dados × 4 colunas');
  });
});

describe('toNumber', () => {
  it.each([
    ['12,5', 12.5],
    ['1.234,56 €', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['(30)', -30],
    ['15%', 15],
    ['abc', null],
    ['2026-11-19', null],
  ])('%s → %s', (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe('readCsv', () => {
  it('detects the separator and keeps quoted fields', () => {
    const sheet = readCsv(
      Buffer.from(
        '\uFEFFnome;nota\r\n"Silva; Ana";"diz ""olá"""\r\n\r\nRui;7\n',
      ),
      'x',
    );
    expect(sheet.rows).toEqual([
      ['nome', 'nota'],
      ['Silva; Ana', 'diz "olá"'],
      ['Rui', '7'],
    ]);
  });
});

describe('docxMarkdown', () => {
  it('keeps headings, lists and tables', () => {
    const text = docxMarkdown(
      zip({
        'word/document.xml':
          '<w:document><w:body>' +
          '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chamadas</w:t></w:r></w:p>' +
          '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">Ligar ao </w:t></w:r><w:r><w:t>Rui</w:t></w:r></w:p>' +
          '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Nome</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Tel</w:t></w:r></w:p></w:tc></w:tr>' +
          '<w:tr><w:tc><w:p><w:r><w:t>Ana</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>912</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
          '</w:body></w:document>',
      }),
    );
    expect(text).toBe(
      '## Chamadas\n\n- Ligar ao Rui\n\n| Nome | Tel |\n| --- | --- |\n| Ana | 912 |',
    );
  });
});

describe('kindOf', () => {
  it('goes by the extension first', () => {
    expect(kindOf('a.XLSX', 'application/octet-stream')).toBe('excel');
    expect(kindOf('scan', 'application/pdf')).toBe('pdf');
    expect(kindOf('a.exe', 'application/octet-stream')).toBeNull();
  });
});
