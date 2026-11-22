import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { AGENT_MODEL, AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { fileLine } from 'src/chat-file/chat-file.service';
import {
  FileContent,
  KIND_LABEL,
  cutText,
  describeTables,
  imageType,
} from 'src/chat-file/helpers/fileContent';
import { queryTable } from 'src/chat-file/helpers/queryTable';
import { Table, fold, renderRows } from 'src/chat-file/helpers/sheetTable';
import { lisbonStamp } from 'src/utils/lisbonTime';

const FILE = {
  type: 'string' as const,
  description: 'O id do ficheiro (vem na mensagem dele ou em chat_files_list).',
};

const SHEET = {
  type: 'string' as const,
  description: 'A folha (o nome). Sem ela, a primeira. Só para Excel e CSV.',
};

export const COLUMN = {
  type: 'string' as const,
  description:
    'A coluna: o nome do cabeçalho (sem acentos nem maiúsculas conta), a letra do Excel ("C") ou o número (1 = a primeira).',
};

const MAX_READ_ROWS = 300;
const READ_CHARS = 40_000;

export const failure = (error: unknown) =>
  `Não consegui: ${error instanceof Error ? error.message : String(error)}`;

export function sheetOf(tables: Table[], name?: string): Table {
  if (!name) return tables[0];
  const table =
    tables.find((entry) => fold(entry.sheet) === fold(name)) ??
    tables.find((entry) => fold(entry.sheet).includes(fold(name)));
  if (!table) {
    throw new Error(
      `não há a folha «${name}». As folhas são: ${tables.map((entry) => `«${entry.sheet}»`).join(', ')}.`,
    );
  }
  return table;
}

/** Os campos de uma consulta a uma folha (chat_file_query, drive_sheet_query). */
export const QUERY_PROPERTIES = {
  where: {
    type: 'array',
    description: 'As condições (todas, ou uma com match "any").',
    items: {
      type: 'object',
      properties: {
        column: COLUMN,
        op: {
          type: 'string',
          enum: [
            '=',
            '!=',
            'contains',
            'not_contains',
            'starts_with',
            'ends_with',
            '>',
            '>=',
            '<',
            '<=',
            'empty',
            'not_empty',
            'in',
          ],
        },
        value: {
          description:
            'O valor (texto, número ou, para "in", uma lista). Texto compara sem acentos nem maiúsculas.',
        },
      },
      required: ['column', 'op'],
    },
  },
  match: { type: 'string', enum: ['all', 'any'] },
  columns: {
    type: 'array',
    items: COLUMN,
    description: 'As colunas a mostrar (omissão: todas).',
  },
  groupBy: {
    type: 'array',
    items: COLUMN,
    description: 'Agrupar por estas colunas.',
  },
  aggregates: {
    type: 'array',
    description:
      'O que calcular (por grupo, ou no total sem groupBy). count não precisa de coluna.',
    items: {
      type: 'object',
      properties: {
        fn: {
          type: 'string',
          enum: ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'],
        },
        column: COLUMN,
      },
      required: ['fn'],
    },
  },
  duplicatesBy: {
    type: 'array',
    items: COLUMN,
    description:
      'Encontrar linhas repetidas por estas colunas (ex.: ["Email"]).',
  },
  sort: {
    type: 'array',
    description:
      'Ordenar: pela coluna (ou, ao agrupar, pelo nome do resultado, ex.: "sum(Valor)").',
    items: {
      type: 'object',
      properties: {
        column: { type: 'string' },
        desc: { type: 'boolean' },
      },
      required: ['column'],
    },
  },
  offset: { type: 'number' },
  limit: {
    type: 'number',
    description: 'Quantas linhas ou grupos devolver (omissão 100, máximo 500).',
  },
};

/** Pergunta a um ficheiro inteiro à IA (o PDF e as imagens tal como são; o resto lido). */
export async function askFile(
  context: AgentContext,
  file: { name: string; mimeType: string },
  data: Buffer,
  content: FileContent,
  question: string,
): Promise<string> {
  const source: ContentBlockParam =
    content.kind === 'pdf'
      ? {
          type: 'document',
          title: file.name,
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: data.toString('base64'),
          },
        }
      : content.kind === 'image'
        ? {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageType(file.name, file.mimeType),
              data: data.toString('base64'),
            },
          }
        : {
            type: 'text',
            text: content.tables
              ? describeTables(content.tables)
              : cutText(content.text ?? ''),
          };
  const response = await context.ai.messages.create({
    model: AGENT_MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          source,
          {
            type: 'text',
            text:
              `Este é o ficheiro «${file.name}». Responde em português europeu a esta pergunta, só com o que está no ficheiro:\n\n${question}\n\n` +
              'Regras: copia os números, datas, nomes e valores exatamente como estão; diz a página (ou a folha e a linha) de onde vem cada coisa; tabelas como listas ou tabelas em Markdown; se algo não estiver no ficheiro ou não se ler bem, di-lo — nunca adivinhes.',
          },
        ],
      },
    ],
  });
  const usage = response.usage;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const record = {
    input: usage.input_tokens + cacheRead + cacheWrite,
    output: usage.output_tokens,
    model: response.model,
    fresh: usage.input_tokens,
    cacheRead,
    cacheWrite,
  };
  context.onUsage?.(record);
  context.recordUsage?.(context.agentKey ?? 'ceo', record);
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  return `«${file.name}»:\n\n${text || '(a IA não devolveu texto)'}`;
}

/**
 * Os ficheiros que ele mandou no chat. As folhas fazem-se no código (filtrar, somar,
 * agrupar, duplicados), para os números saírem certos; o PDF e as imagens analisam-se
 * pela IA, com o ficheiro inteiro e a pergunta concreta.
 */
export function buildChatFileTools(context: AgentContext): AgentTool[] {
  const files = context.chatFiles;
  const open = (id: string) => files.get(context.userId, id);

  return [
    {
      name: 'chat_files_list',
      description:
        'Os ficheiros que ele mandou nesta conversa (sem conversa, os últimos que mandou): o id, o nome, o tipo, o tamanho e, nas folhas, as folhas e quantas linhas têm.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        try {
          const list = await files.list(context.userId, context.conversationId);
          if (!list.length)
            return 'Ele ainda não mandou ficheiros nesta conversa.';
          const lines: string[] = [];
          for (const info of list) {
            let detail = '';
            try {
              const content = files.content(await open(info.id));
              if (content.tables) {
                detail = ` — folhas: ${content.tables.map((table) => `«${table.sheet}» (${table.rows.length} linhas)`).join(', ')}`;
              } else if (content.pages) {
                detail = ` — ${content.pages} páginas`;
              }
            } catch {
              detail = ' — não se consegue abrir';
            }
            lines.push(
              `- ${fileLine(info)}, enviado ${lisbonStamp(info.createdAt)}${detail}`,
            );
          }
          return lines.join('\n');
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'chat_file_read',
      description:
        'Lê um ficheiro que ele mandou. Excel e CSV: o perfil das colunas e as linhas de uma folha (fromRow e toRow são as linhas do Excel; até 300 de cada vez). Word e texto: o texto em Markdown, a partir de offset (40 000 caracteres de cada vez). PDF e imagens: usa chat_file_ask.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: FILE,
          sheet: SHEET,
          fromRow: {
            type: 'number',
            description: 'A primeira linha (número do Excel).',
          },
          toRow: {
            type: 'number',
            description: 'A última linha (número do Excel).',
          },
          offset: {
            type: 'number',
            description: 'Word e texto: o caractere onde começar (omissão 0).',
          },
        },
        required: ['fileId'],
      },
      handler: async (input: {
        fileId: string;
        sheet?: string;
        fromRow?: number;
        toRow?: number;
        offset?: number;
      }) => {
        try {
          const file = await open(input.fileId);
          const content = files.content(file);
          if (content.tables) {
            const table = sheetOf(content.tables, input.sheet);
            const from = input.fromRow ?? table.rows[0]?.line ?? 1;
            const to = Math.min(
              input.toRow ?? from + MAX_READ_ROWS - 1,
              from + MAX_READ_ROWS - 1,
            );
            const rows = table.rows.filter(
              (row) => row.line >= from && row.line <= to,
            );
            const others =
              content.tables.length > 1
                ? `\nOutras folhas: ${content.tables
                    .filter((entry) => entry !== table)
                    .map((entry) => `«${entry.sheet}»`)
                    .join(', ')}.`
                : '';
            if (input.fromRow === undefined && input.toRow === undefined) {
              return `«${file.name}»${others}\n\n${describeTables([table])}`;
            }
            return `«${file.name}», folha «${table.sheet}», linhas ${from}–${to} (${rows.length} com dados, de ${table.rows.length} no total):${others}\n\n${rows.length ? renderRows(table, rows) : 'Nenhuma linha neste intervalo.'}`;
          }
          if (content.text !== undefined) {
            return `«${file.name}» (${KIND_LABEL[content.kind]}, ${content.text.length} caracteres):\n\n${cutText(content.text, Math.max(input.offset ?? 0, 0), READ_CHARS) || '(sem texto)'}`;
          }
          return `«${file.name}» é ${KIND_LABEL[content.kind]}: usa chat_file_ask com a pergunta.`;
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'chat_file_query',
      description:
        'Faz contas exatas numa folha de Excel ou CSV que ele mandou, no código: filtrar linhas (where), escolher colunas e ordenar, agrupar e somar/contar/média/mínimo/máximo (groupBy + aggregates), ou encontrar duplicados (duplicatesBy). Usa-a sempre que a resposta for um número, uma contagem, um total, um top ou uma lista filtrada — nunca contes a olho. Os números aceitam "1.234,56 €"; as datas comparam-se como "2026-11-19".',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: FILE,
          sheet: SHEET,
          ...QUERY_PROPERTIES,
        },
        required: ['fileId'],
      },
      handler: async (
        input: { fileId: string; sheet?: string } & Parameters<
          typeof queryTable
        >[1],
      ) => {
        try {
          const file = await open(input.fileId);
          const content = files.content(file);
          if (!content.tables) {
            return `«${file.name}» não é uma folha (é ${KIND_LABEL[content.kind]}). Usa chat_file_read ou chat_file_ask.`;
          }
          return queryTable(sheetOf(content.tables, input.sheet), input);
        } catch (error) {
          return failure(error);
        }
      },
    },
    {
      name: 'chat_file_ask',
      description:
        'Pergunta a um ficheiro que ele mandou: a IA lê-o inteiro (o PDF com o texto e as páginas como imagens, incluindo tabelas, gráficos e digitalizações) e responde só com o que lá está, com a página. Serve para os PDF e as imagens, para os ficheiros de mensagens anteriores e para quem recebeu o trabalho sem o ficheiro. Faz perguntas concretas ("todos os valores da tabela da pág. 3", "as datas e prazos", "transcreve a fatura").',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: FILE,
          question: {
            type: 'string',
            description: 'O que queres saber do ficheiro, completo.',
          },
        },
        required: ['fileId', 'question'],
      },
      handler: async (input: { fileId: string; question: string }) => {
        try {
          const file = await open(input.fileId);
          const content = files.content(file);
          return await askFile(
            context,
            file,
            Buffer.from(file.data),
            content,
            input.question,
          );
        } catch (error) {
          return failure(error);
        }
      },
    },
  ];
}
