import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  COLUMN,
  QUERY_PROPERTIES,
  askFile,
  failure,
  sheetOf,
} from './chat-file-tools';
import {
  DriveFile,
  FOLDER,
  GOOGLE_DOC,
  GOOGLE_SHEET,
  XLSX,
  copyDriveFile,
  createDriveFile,
  downloadDriveFile,
  driveFileId,
  exportDriveFile,
  getDriveFile,
  listRevisions,
  revisionContent,
  searchDrive,
} from 'src/google-drive/drive.client';
import {
  addTab,
  formatSheet,
  appendRows,
  quoteTab,
  readTab,
  sheetTabs,
  writeCells,
} from 'src/google-drive/sheets.client';
import { DriveSession } from 'src/google-drive/drive.service';
import {
  SheetFormatInput,
  sheetFormatRequests,
} from 'src/google-drive/helpers/sheetFormat';
import {
  FileContent,
  KIND_LABEL,
  cutText,
  describeTables,
  readContent,
} from 'src/chat-file/helpers/fileContent';
import { queryTable } from 'src/chat-file/helpers/queryTable';
import {
  Table,
  fold,
  renderRows,
  resolveColumn,
  show,
  toTable,
} from 'src/chat-file/helpers/sheetTable';
import {
  CellValue,
  columnLetter,
  readWorkbook,
} from 'src/chat-file/helpers/readWorkbook';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O email da conta do Drive (só se houver mais de uma).',
};

const FILE = {
  type: 'string' as const,
  description:
    'O ficheiro: o id, o link do Drive/Folhas ou o nome exato (de drive_search ou drive_links).',
};

const SHEET = {
  type: 'string' as const,
  description: 'A folha (o separador). Sem ela, a primeira.',
};

const MAX_TABS = 10;
const MAX_READ_ROWS = 300;
const MAX_CHANGES = 200;

type CellInput = string | number | boolean | null;

const KIND: Record<string, string> = {
  [FOLDER]: 'pasta',
  [GOOGLE_SHEET]: 'Folha do Google',
  [GOOGLE_DOC]: 'Doc do Google',
  [XLSX]: 'Excel',
  'application/pdf': 'PDF',
};

const kindOf = (file: DriveFile) =>
  KIND[file.mimeType] ??
  (file.mimeType.startsWith('application/vnd.google-apps.')
    ? file.mimeType.slice('application/vnd.google-apps.'.length)
    : file.mimeType);

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-PT', {
        timeZone: 'Europe/Lisbon',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

const who = (user?: { displayName?: string; emailAddress?: string }) =>
  user?.displayName || user?.emailAddress || 'alguém';

/**
 * O Google Drive e as Folhas do Google. Ler, procurar e fazer contas em todo o Drive;
 * mudar só no que estiver ligado a um projeto (o código recusa o resto). O que fazer com
 * cada ficheiro está nos documentos do projeto — as ferramentas não decidem nada.
 */
export function buildDriveTools(context: AgentContext): AgentTool[] {
  const drive = context.drive;
  const open = (accountEmail?: string) =>
    drive.session(context.userId, accountEmail);

  /** O ficheiro pelo id, pelo link ou pelo nome exato (um só). */
  async function resolve(session: DriveSession, value: string) {
    const id = driveFileId(value);
    if (/^[\w-]{20,}$/.test(id)) return getDriveFile(session.token, id);
    const found = (
      await searchDrive(session.token, { text: value, limit: 20 })
    ).filter((file) => fold(file.name) === fold(value));
    if (found.length === 1) return found[0];
    throw new Error(
      found.length
        ? `há ${found.length} ficheiros com o nome «${value}»; usa o id (${found.map((file) => file.id).join(', ')})`
        : `não encontrei «${value}» no Drive; procura com drive_search`,
    );
  }

  /** As folhas de uma Folha do Google, de um Excel ou de um CSV, como tabelas. */
  async function tablesOf(
    session: DriveSession,
    file: DriveFile,
    sheet?: string,
  ): Promise<Table[]> {
    if (file.mimeType === GOOGLE_SHEET) {
      const tabs = await sheetTabs(session.token, file.id);
      const wanted = sheet
        ? [
            tabs.find((tab) => fold(tab.title) === fold(sheet)) ??
              tabs.find((tab) => fold(tab.title).includes(fold(sheet))),
          ]
        : tabs.slice(0, MAX_TABS);
      if (!wanted[0]) {
        throw new Error(
          `não há a folha «${sheet}». As folhas são: ${tabs.map((tab) => `«${tab.title}»`).join(', ')}.`,
        );
      }
      const tables: Table[] = [];
      for (const tab of wanted) {
        tables.push(toTable(await readTab(session.token, file.id, tab!.title)));
      }
      return tables;
    }
    const content = await contentOf(session, file);
    if (!content.tables) {
      throw new Error(
        `«${file.name}» não é uma folha de cálculo (é ${kindOf(file)})`,
      );
    }
    return sheet ? [sheetOf(content.tables, sheet)] : content.tables;
  }

  /** O conteúdo de um ficheiro normal, lido como os do chat (Excel, Word, CSV, texto). */
  async function contentOf(
    session: DriveSession,
    file: DriveFile,
  ): Promise<FileContent & { data: Buffer }> {
    if (file.mimeType === GOOGLE_DOC) {
      const { data } = await exportDriveFile(
        session.token,
        file.id,
        'text/markdown',
      );
      return { kind: 'text', text: data.toString('utf8'), data };
    }
    if (file.mimeType.startsWith('application/vnd.google-apps.')) {
      throw new Error(`não sei ler um ficheiro do tipo ${kindOf(file)}`);
    }
    const { data } = await downloadDriveFile(session.token, file.id);
    return { ...readContent(file.name, file.mimeType, data), data };
  }

  /** Uma Folha do Google onde se pode escrever (ligada a um projeto). */
  async function writableSheet(
    session: DriveSession,
    value: string,
    what: string,
  ) {
    const file = await resolve(session, value);
    if (file.mimeType !== GOOGLE_SHEET) {
      throw new Error(
        file.mimeType === XLSX
          ? `«${file.name}» é um Excel (.xlsx): para mexer nas células, converte-o primeiro numa Folha do Google com drive_convert_to_sheet`
          : `«${file.name}» não é uma Folha do Google (é ${kindOf(file)})`,
      );
    }
    const links = await drive.assertWritable(
      session,
      file.id,
      `${what} «${file.name}»`,
    );
    return { file, links };
  }

  const linkedTo = (links: { project: { name: string } }[]) =>
    [...new Set(links.map((link) => link.project.name))].join(', ');

  return [
    {
      name: 'drive_search',
      description:
        'Procura no Google Drive dele, pelo nome e pelo conteúdo, ou lista uma pasta. Devolve o id, o nome, o tipo, quando mudou e quem, e se está ligado a um projeto (só nesses se pode mudar).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'O que procurar (nome ou texto).',
          },
          folder: {
            type: 'string',
            description: 'Listar só dentro desta pasta (id ou link).',
          },
          type: {
            type: 'string',
            enum: ['any', 'sheet', 'doc', 'folder', 'pdf', 'excel'],
          },
          limit: { type: 'number', description: 'Até 100 (omissão 30).' },
          accountEmail: ACCOUNT,
        },
      },
      handler: async (input: {
        query?: string;
        folder?: string;
        type?: string;
        limit?: number;
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const mimeType = {
            sheet: GOOGLE_SHEET,
            doc: GOOGLE_DOC,
            folder: FOLDER,
            pdf: 'application/pdf',
            excel: XLSX,
          }[input.type ?? ''];
          const files = await searchDrive(session.token, {
            text: input.query?.trim() || undefined,
            folderId: input.folder ? driveFileId(input.folder) : undefined,
            mimeType,
            limit: input.limit,
          });
          if (!files.length) return 'Não encontrei nada.';
          const links = await drive.links(context.userId, session.account.id);
          const linked = new Map(
            links.map((link) => [link.fileId, link.project.name]),
          );
          return files
            .map(
              (file) =>
                `- «${file.name}» (${kindOf(file)}, id ${file.id}) — mudou ${when(file.modifiedTime)} por ${who(file.lastModifyingUser)}${linked.has(file.id) ? ` — ligado ao projeto ${linked.get(file.id)}` : ''}`,
            )
            .join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_links',
      description:
        'As pastas e os ficheiros do Drive ligados a cada projeto. Só nesses (e dentro das pastas) se pode mudar alguma coisa; o resto do Drive é só para ler.',
      inputSchema: { type: 'object', properties: { accountEmail: ACCOUNT } },
      handler: async (input: { accountEmail?: string }) => {
        try {
          const session = await open(input.accountEmail);
          const links = await drive.links(context.userId, session.account.id);
          if (!links.length) {
            return 'Não há nada do Drive ligado a projetos: posso ler, mas não mudar. Ele liga em Apps ligadas → Google Drive → Ligações a projetos.';
          }
          return links
            .map(
              (link) =>
                `- Projeto ${link.project.name}: «${link.name}» (${KIND[link.mimeType] ?? link.mimeType}, id ${link.fileId})`,
            )
            .join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_read',
      description:
        'Lê um ficheiro do Drive. Folha do Google, Excel ou CSV: o perfil das colunas e as linhas com o número de cada uma (uma folha, ou todas; fromRow/toRow para um intervalo, até 300). Doc do Google, Word e texto: o texto (offset para continuar). Pasta: o que tem dentro. PDF e imagens: usa drive_ask.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          sheet: SHEET,
          fromRow: { type: 'number' },
          toRow: { type: 'number' },
          offset: { type: 'number' },
          accountEmail: ACCOUNT,
        },
        required: ['file'],
      },
      handler: async (input: {
        file: string;
        sheet?: string;
        fromRow?: number;
        toRow?: number;
        offset?: number;
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const file = await resolve(session, input.file);
          const head = `«${file.name}» (${kindOf(file)}, id ${file.id}; mudou ${when(file.modifiedTime)} por ${who(file.lastModifyingUser)})`;
          if (file.mimeType === FOLDER) {
            const inside = await searchDrive(session.token, {
              folderId: file.id,
              limit: 100,
            });
            return `${head}:\n${inside.map((item) => `- «${item.name}» (${kindOf(item)}, id ${item.id})`).join('\n') || '(vazia)'}`;
          }
          if (
            file.mimeType === GOOGLE_SHEET ||
            /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name)
          ) {
            const tables = await tablesOf(session, file, input.sheet);
            if (input.fromRow !== undefined || input.toRow !== undefined) {
              const table = tables[0];
              const from = input.fromRow ?? 1;
              const to = Math.min(
                input.toRow ?? from + MAX_READ_ROWS - 1,
                from + MAX_READ_ROWS - 1,
              );
              const rows = table.rows.filter(
                (row) => row.line >= from && row.line <= to,
              );
              return `${head}, folha «${table.sheet}», linhas ${from}–${to}:\n\n${rows.length ? renderRows(table, rows) : 'Nenhuma linha neste intervalo.'}`;
            }
            return `${head}:\n\n${describeTables(tables)}`;
          }
          const content = await contentOf(session, file);
          if (content.text !== undefined) {
            return `${head}:\n\n${cutText(content.text, Math.max(input.offset ?? 0, 0), 40_000) || '(sem texto)'}`;
          }
          return `${head} é ${KIND_LABEL[content.kind]}: usa drive_ask com a pergunta.`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_sheet_query',
      description:
        'Faz contas exatas numa Folha do Google (ou num Excel/CSV do Drive), no código: filtrar, agrupar e somar/contar, duplicados, ordenar. Usa-a para procurar linhas (ex.: um cliente pelo telefone ou pelo código) antes de as mudar e para qualquer número ou contagem — nunca a olho. Devolve as linhas com o número de cada uma, que é o que drive_sheet_update usa.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          sheet: SHEET,
          ...QUERY_PROPERTIES,
          accountEmail: ACCOUNT,
        },
        required: ['file'],
      },
      handler: async (
        input: {
          file: string;
          sheet?: string;
          accountEmail?: string;
        } & Parameters<typeof queryTable>[1],
      ) => {
        try {
          const session = await open(input.accountEmail);
          const file = await resolve(session, input.file);
          const [table] = await tablesOf(session, file, input.sheet);
          return `«${file.name}»\n${queryTable(table, input)}`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_ask',
      description:
        'Pergunta a um ficheiro do Drive: a IA lê-o inteiro (PDF com as páginas, imagens, Docs, folhas) e responde só com o que lá está, com a página ou a linha.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          question: {
            type: 'string',
            description: 'O que queres saber, completo.',
          },
          accountEmail: ACCOUNT,
        },
        required: ['file', 'question'],
      },
      handler: async (input: {
        file: string;
        question: string;
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const file = await resolve(session, input.file);
          if (file.mimeType === GOOGLE_SHEET) {
            const tables = await tablesOf(session, file);
            return await askFile(
              context,
              file,
              Buffer.alloc(0),
              { kind: 'excel', tables },
              input.question,
            );
          }
          const content = await contentOf(session, file);
          return await askFile(
            context,
            file,
            content.data,
            content,
            input.question,
          );
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_history',
      description:
        'O histórico de um ficheiro do Drive: as versões (quando e quem). Numa Folha do Google, compara duas versões e diz que células mudaram (folha, célula, coluna, antes → depois), entre que horas e por quem. O Google junta as edições próximas numa versão: a hora é a da versão, não de cada célula.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          since: {
            type: 'string',
            description:
              'Comparar o que mudou desde esta data/hora ("2026-11-19 09:00"). Sem ela, a última versão com a anterior.',
          },
          sheet: SHEET,
          listOnly: { type: 'boolean', description: 'Só a lista das versões.' },
          accountEmail: ACCOUNT,
        },
        required: ['file'],
      },
      handler: async (input: {
        file: string;
        since?: string;
        sheet?: string;
        listOnly?: boolean;
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const file = await resolve(session, input.file);
          const revisions = await listRevisions(session.token, file.id);
          if (!revisions.length)
            return `«${file.name}» não tem versões guardadas.`;
          const list = revisions
            .slice(-30)
            .map(
              (revision) =>
                `- ${when(revision.modifiedTime)} — ${who(revision.lastModifyingUser)} (versão ${revision.id})`,
            )
            .join('\n');
          if (
            input.listOnly ||
            file.mimeType !== GOOGLE_SHEET ||
            revisions.length < 2
          ) {
            return `«${file.name}» — ${revisions.length} versões (as últimas):\n${list}`;
          }
          const since = input.since
            ? new Date(input.since.replace(' ', 'T'))
            : null;
          const newest = revisions[revisions.length - 1];
          const base =
            since && !Number.isNaN(since.getTime())
              ? ([...revisions]
                  .reverse()
                  .find(
                    (revision) => new Date(revision.modifiedTime) <= since,
                  ) ?? revisions[0])
              : revisions[revisions.length - 2];
          const between = revisions.filter(
            (revision) =>
              revision.modifiedTime > base.modifiedTime &&
              revision.modifiedTime <= newest.modifiedTime,
          );
          const link = (revision: typeof newest) =>
            revision.exportLinks?.[XLSX];
          if (!link(base) || !link(newest))
            return `Não consigo descarregar estas versões.\n${list}`;
          const [before, after] = await Promise.all([
            revisionContent(session.token, link(base)!),
            revisionContent(session.token, link(newest)!),
          ]);
          const changes = diffWorkbooks(
            readWorkbook(before.data),
            readWorkbook(after.data),
            input.sheet,
          );
          const authors = [
            ...new Set(
              between.map((revision) => who(revision.lastModifyingUser)),
            ),
          ].join(', ');
          return [
            `«${file.name}»: de ${when(base.modifiedTime)} a ${when(newest.modifiedTime)} (${between.length} versões, por ${authors || 'alguém'}).`,
            changes.length
              ? `${changes.length} células mudaram${changes.length > MAX_CHANGES ? ` (as primeiras ${MAX_CHANGES})` : ''}:\n${changes.slice(0, MAX_CHANGES).join('\n')}`
              : 'Nenhuma célula mudou.',
            `\nVersões:\n${list}`,
          ].join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_sheet_update',
      description:
        'Muda células de uma Folha do Google ligada a um projeto. Cada mudança: a linha (o número, de drive_sheet_query ou drive_read), a coluna (o nome do cabeçalho ou a letra) e o valor (escrito como à mão: "2026-11-19" fica data, "12,5" número). Devolve o antes → depois de cada célula. Lê antes o documento do projeto para saber que colunas mudar.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          sheet: SHEET,
          cells: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                row: { type: 'number', description: 'O número da linha.' },
                column: COLUMN,
                value: { description: 'O valor novo (vazio para limpar).' },
              },
              required: ['row', 'column', 'value'],
            },
          },
          accountEmail: ACCOUNT,
        },
        required: ['file', 'cells'],
      },
      handler: async (input: {
        file: string;
        sheet?: string;
        cells: { row: number; column: string; value: CellInput }[];
        accountEmail?: string;
      }) => {
        try {
          if (!input.cells?.length) return 'Não disseste que células mudar.';
          if (input.cells.length > 2000)
            return 'São demasiadas células de uma vez (máximo 2000).';
          const session = await open(input.accountEmail);
          const { file, links } = await writableSheet(
            session,
            input.file,
            'mudar',
          );
          const [table] = await tablesOf(session, file, input.sheet);
          const byLine = new Map(
            table.rows.map((row) => [row.line, row.cells]),
          );
          const planned = input.cells.map((cell) => {
            const index = resolveColumn(table, cell.column);
            return {
              range: `${quoteTab(table.sheet)}!${columnLetter(index)}${cell.row}`,
              label: `linha ${cell.row}, ${table.columns[index]} (${columnLetter(index)}${cell.row})`,
              before: show(byLine.get(cell.row)?.[index] ?? null),
              value: cell.value,
            };
          });
          const updated = await writeCells(session.token, file.id, planned);
          return [
            `«${file.name}», folha «${table.sheet}» (projeto ${linkedTo(links)}): ${updated} células mudadas.`,
            ...planned.map(
              (cell) =>
                `- ${cell.label}: «${cell.before}» → «${show(cell.value)}»`,
            ),
          ].join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_sheet_append',
      description:
        'Acrescenta linhas no fim da tabela de uma Folha do Google ligada a um projeto. Cada linha é um objeto { "nome da coluna": valor } com os nomes do cabeçalho (as colunas que faltarem ficam vazias). Confirma antes com drive_sheet_query que a linha ainda não existe.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          sheet: SHEET,
          rows: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          accountEmail: ACCOUNT,
        },
        required: ['file', 'rows'],
      },
      handler: async (input: {
        file: string;
        sheet?: string;
        rows: Record<string, CellInput>[];
        accountEmail?: string;
      }) => {
        try {
          if (!input.rows?.length) return 'Não há linhas para acrescentar.';
          if (input.rows.length > 1000)
            return 'São demasiadas linhas de uma vez (máximo 1000).';
          const session = await open(input.accountEmail);
          const { file, links } = await writableSheet(
            session,
            input.file,
            'acrescentar linhas a',
          );
          const [table] = await tablesOf(session, file, input.sheet);
          if (!table.headerRow) {
            return `A folha «${table.sheet}» não tem cabeçalho: não sei em que colunas pôr cada valor.`;
          }
          const values = input.rows.map((row) => {
            const cells: CellInput[] = table.columns.map(() => null);
            for (const [name, value] of Object.entries(row)) {
              cells[resolveColumn(table, name)] = value;
            }
            return cells;
          });
          const range = await appendRows(
            session.token,
            file.id,
            table.sheet,
            values,
          );
          return `«${file.name}», folha «${table.sheet}» (projeto ${linkedTo(links)}): ${values.length} linhas acrescentadas (${range.split('!')[1] ?? range}).`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_sheet_add_tab',
      description:
        'Cria uma folha (separador) nova numa Folha do Google ligada a um projeto, opcionalmente com o cabeçalho.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          title: { type: 'string' },
          headers: { type: 'array', items: { type: 'string' } },
          accountEmail: ACCOUNT,
        },
        required: ['file', 'title'],
      },
      handler: async (input: {
        file: string;
        title: string;
        headers?: string[];
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const { file } = await writableSheet(
            session,
            input.file,
            'criar uma folha em',
          );
          await addTab(session.token, file.id, input.title);
          if (input.headers?.length)
            await appendRows(session.token, file.id, input.title, [
              input.headers,
            ]);
          return `Criei a folha «${input.title}» em «${file.name}».`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_create',
      description:
        'Cria um ficheiro numa pasta ligada a um projeto: uma Folha do Google (com o cabeçalho, se quiseres) ou um Doc do Google vazios, ou guarda lá um ficheiro que ele mandou no chat (chatFileId; um Excel pode ir convertido em Folha do Google). O ficheiro novo fica ligado aos mesmos projetos.',
      inputSchema: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'A pasta (id, link ou nome exato).',
          },
          name: { type: 'string' },
          type: { type: 'string', enum: ['sheet', 'doc', 'chat_file'] },
          headers: { type: 'array', items: { type: 'string' } },
          chatFileId: {
            type: 'string',
            description: 'O id do ficheiro do chat (type chat_file).',
          },
          convert: {
            type: 'boolean',
            description: 'Um Excel do chat vai como Folha do Google.',
          },
          accountEmail: ACCOUNT,
        },
        required: ['folder', 'name', 'type'],
      },
      handler: async (input: {
        folder: string;
        name: string;
        type: 'sheet' | 'doc' | 'chat_file';
        headers?: string[];
        chatFileId?: string;
        convert?: boolean;
        accountEmail?: string;
      }) => {
        try {
          const session = await open(input.accountEmail);
          const folder = await resolve(session, input.folder);
          if (folder.mimeType !== FOLDER)
            return `«${folder.name}» não é uma pasta.`;
          const links = await drive.assertWritable(
            session,
            folder.id,
            `criar ficheiros na pasta «${folder.name}»`,
          );
          let created: DriveFile;
          if (input.type === 'chat_file') {
            if (!input.chatFileId) return 'Falta o chatFileId.';
            const chatFile = await context.chatFiles.get(
              context.userId,
              input.chatFileId,
            );
            const asSheet =
              input.convert && /\.(xlsx|xlsm|csv)$/i.test(chatFile.name);
            created = await createDriveFile(
              session.token,
              {
                name: asSheet
                  ? input.name.replace(/\.(xlsx|xlsm|csv)$/i, '')
                  : input.name,
                mimeType: asSheet ? GOOGLE_SHEET : chatFile.mimeType,
                parents: [folder.id],
              },
              { data: Buffer.from(chatFile.data), mimeType: chatFile.mimeType },
            );
          } else {
            created = await createDriveFile(session.token, {
              name: input.name,
              mimeType: input.type === 'sheet' ? GOOGLE_SHEET : GOOGLE_DOC,
              parents: [folder.id],
            });
            if (input.type === 'sheet' && input.headers?.length) {
              const [tab] = await sheetTabs(session.token, created.id);
              await appendRows(session.token, created.id, tab.title, [
                input.headers,
              ]);
            }
          }
          await drive.linkCreated(session, created, [
            ...new Set(links.map((link) => link.projectId)),
          ]);
          return `Criei «${created.name}» (${kindOf(created)}, id ${created.id}) na pasta «${folder.name}» — ligado ao projeto ${linkedTo(links)}. ${created.webViewLink ?? ''}`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_sheet_format',
      description:
        'Muda o aspeto e as regras de uma Folha do Google ligada a um projeto, sem tocar nos valores: converter os dados numa tabela do Sheets (table, com filtros e cores alternadas), o cabeçalho (negrito, cores) e fixá-lo, o tipo de cada coluna (texto, número, moeda, percentagem, data, menu com opções e a cor de cada opção, caixa de seleção), destacar células ou linhas inteiras por valor (ex.: Estado = «Levantado» a verde), filtros, bordas e a largura das colunas. Cores em #RRGGBB. Tudo num só pedido: ou fica tudo, ou nada.',
      inputSchema: {
        type: 'object',
        properties: {
          file: FILE,
          sheet: SHEET,
          table: {
            type: 'object',
            description:
              'Converte os dados (do cabeçalho à última linha) numa tabela do Sheets. Os tipos de columns passam a ser os da tabela.',
            properties: { name: { type: 'string' } },
          },
          header: {
            type: 'object',
            properties: {
              bold: { type: 'boolean' },
              background: { type: 'string' },
              textColor: { type: 'string' },
            },
          },
          freezeHeader: { type: 'boolean' },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: COLUMN,
                type: {
                  type: 'string',
                  enum: [
                    'text',
                    'number',
                    'currency',
                    'percent',
                    'date',
                    'datetime',
                    'dropdown',
                    'checkbox',
                  ],
                },
                values: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'As opções do menu (dropdown).',
                },
                colors: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description:
                    'A cor de cada opção ({ "Levantado": "#b7e1cd", "No": "#e06666" }); a letra fica legível sozinha.',
                },
              },
              required: ['column', 'type'],
            },
          },
          highlight: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: COLUMN,
                when: {
                  type: 'string',
                  enum: ['equals', 'contains', 'empty', 'not_empty'],
                },
                value: { type: 'string' },
                background: { type: 'string' },
                textColor: { type: 'string' },
                wholeRow: {
                  type: 'boolean',
                  description: 'Pinta a linha toda (não com contains).',
                },
              },
              required: ['column', 'when'],
            },
          },
          filter: { type: 'boolean' },
          borders: { type: 'boolean' },
          autoResize: { type: 'boolean' },
          accountEmail: ACCOUNT,
        },
        required: ['file'],
      },
      handler: async (
        input: SheetFormatInput & {
          file: string;
          sheet?: string;
          accountEmail?: string;
        },
      ) => {
        try {
          const session = await open(input.accountEmail);
          const { file, links } = await writableSheet(
            session,
            input.file,
            'mudar o aspeto de',
          );
          const [table] = await tablesOf(session, file, input.sheet);
          if (!table.columns.length) return 'A folha está vazia.';
          const tab = (await sheetTabs(session.token, file.id)).find(
            (item) => item.title === table.sheet,
          );
          if (!tab) return `Não encontrei a folha «${table.sheet}».`;
          const { requests, done } = sheetFormatRequests(
            table,
            tab.sheetId,
            input,
          );
          if (!requests.length) return 'Não disseste o que mudar no aspeto.';
          await formatSheet(session.token, file.id, requests);
          return [
            `«${file.name}», folha «${table.sheet}» (projeto ${linkedTo(links)}):`,
            ...done.map((line) => `- ${line}`),
            file.webViewLink ?? '',
          ].join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_create_folder',
      description:
        'Cria uma pasta no Drive: na raiz ou dentro de outra (parent). Criar uma pasta nova não mexe em nada do que já lá está, por isso pode ser em qualquer sítio. Com project, a pasta fica logo ligada a esse projeto (e passa-se a poder criar e mudar lá dentro). Se já houver uma pasta com esse nome no mesmo sítio, usa essa e não cria outra.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parent: {
            type: 'string',
            description:
              'A pasta onde criar (id, link ou nome exato). Omissão: a raiz do Drive.',
          },
          project: {
            type: 'string',
            description:
              'O projeto do MyHomeLab a que fica ligada (nome ou prefixo).',
          },
          accountEmail: ACCOUNT,
        },
        required: ['name'],
      },
      handler: async (input: {
        name: string;
        parent?: string;
        project?: string;
        accountEmail?: string;
      }) => {
        try {
          const name = input.name.trim();
          if (!name) return 'Falta o nome da pasta.';
          const session = await open(input.accountEmail);
          let project: { id: string; name: string } | undefined;
          if (input.project) {
            const wanted = fold(input.project);
            const projects = await context.board.projects(context.userId);
            project = projects.find(
              (item) =>
                fold(item.name) === wanted || fold(item.identifier) === wanted,
            );
            if (!project) {
              return `Não há o projeto "${input.project}". Os projetos são: ${projects.map((item) => item.name).join(', ')}.`;
            }
          }
          const parent = input.parent
            ? await resolve(session, input.parent)
            : undefined;
          if (parent && parent.mimeType !== FOLDER)
            return `«${parent.name}» não é uma pasta.`;
          const where = parent
            ? `na pasta «${parent.name}»`
            : 'na raiz do Drive';
          const existing = (
            await searchDrive(session.token, {
              folderId: parent?.id ?? 'root',
              mimeType: FOLDER,
              limit: 100,
            })
          ).find((file) => fold(file.name) === fold(name));
          const folder =
            existing ??
            (await createDriveFile(session.token, {
              name,
              mimeType: FOLDER,
              parents: parent ? [parent.id] : undefined,
            }));
          if (project) await drive.linkCreated(session, folder, [project.id]);
          return [
            existing
              ? `Já havia a pasta «${folder.name}» ${where} (id ${folder.id}): não criei outra.`
              : `Criei a pasta «${folder.name}» ${where} (id ${folder.id}).`,
            project ? `Está ligada ao projeto ${project.name}.` : null,
            folder.webViewLink ?? null,
          ]
            .filter(Boolean)
            .join(' ');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'drive_convert_to_sheet',
      description:
        'Faz uma cópia de um Excel (.xlsx) ligado a um projeto como Folha do Google, na mesma pasta, para se poder mexer nas células. O original fica como está; a cópia fica ligada aos mesmos projetos. Diz-lhe que passa a haver as duas.',
      inputSchema: {
        type: 'object',
        properties: { file: FILE, accountEmail: ACCOUNT },
        required: ['file'],
      },
      handler: async (input: { file: string; accountEmail?: string }) => {
        try {
          const session = await open(input.accountEmail);
          const file = await resolve(session, input.file);
          if (file.mimeType !== XLSX)
            return `«${file.name}» não é um Excel (.xlsx).`;
          const links = await drive.assertWritable(
            session,
            file.id,
            `converter «${file.name}»`,
          );
          const copy = await copyDriveFile(session.token, file.id, {
            name: file.name.replace(/\.(xlsx|xlsm)$/i, ''),
            mimeType: GOOGLE_SHEET,
            parents: file.parents,
          });
          await drive.linkCreated(session, copy, [
            ...new Set(links.map((link) => link.projectId)),
          ]);
          return `Criei a Folha do Google «${copy.name}» (id ${copy.id}) a partir de «${file.name}», na mesma pasta, ligada ao projeto ${linkedTo(links)}. ${copy.webViewLink ?? ''}`;
        } catch (error) {
          return failure(error);
        }
      },
    },
  ];
}

/** As células que mudaram entre duas versões de um livro, em linhas para o modelo. */
export function diffWorkbooks(
  before: ReturnType<typeof readWorkbook>,
  after: ReturnType<typeof readWorkbook>,
  sheet?: string,
): string[] {
  const changes: string[] = [];
  const names = [
    ...new Set([
      ...before.map((tab) => tab.name),
      ...after.map((tab) => tab.name),
    ]),
  ].filter((name) => !sheet || fold(name) === fold(sheet));
  for (const name of names) {
    const old = before.find((tab) => tab.name === name);
    const now = after.find((tab) => tab.name === name);
    if (!old) {
      changes.push(`Folha «${name}»: nova.`);
      continue;
    }
    if (!now) {
      changes.push(`Folha «${name}»: apagada.`);
      continue;
    }
    const header = now.rowNumbers[0] === 1 ? toTable(now) : null;
    const cells = (tab: typeof now) => {
      const map = new Map<string, CellValue>();
      tab.rows.forEach((row, index) =>
        row.forEach((value, column) => {
          if (value !== null)
            map.set(`${tab.rowNumbers[index]}:${column}`, value);
        }),
      );
      return map;
    };
    const a = cells(old);
    const b = cells(now);
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => {
      const [rx, cx] = x.split(':').map(Number);
      const [ry, cy] = y.split(':').map(Number);
      return rx - ry || cx - cy;
    })) {
      const from = show(a.get(key) ?? null);
      const to = show(b.get(key) ?? null);
      if (from === to) continue;
      const [row, column] = key.split(':').map(Number);
      const label = header?.headerRow ? ` («${header.columns[column]}»)` : '';
      changes.push(
        `- «${name}» ${columnLetter(column)}${row}${label}: «${from}» → «${to}»`,
      );
    }
  }
  return changes;
}
