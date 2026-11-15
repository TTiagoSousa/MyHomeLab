import type { AiClient } from 'src/ai-credential/ai-client';
import { SUBAGENT_MODEL } from 'src/assistant/claude-agent.client';
import { LAB_ANALYTES, analyteKey } from './labAnalytes';
import { labFlag } from './labFlag';

export interface ExtractedLabResult {
  key: string;
  name: string;
  section: string | null;
  group: string | null;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: string | null;
}

export interface ExtractedLabReport {
  lab: string | null;
  collectedAt: string | null;
  results: ExtractedLabResult[];
}

const TOOL_NAME = 'save_lab_results';

// Os campos que o Claude tem de preencher. É isto que faz funcionar com PDFs de
// laboratórios diferentes: não se diz onde está cada valor, diz-se o que se
// quer, e ele encontra a tabela de resultados como uma pessoa a encontraria.
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      description:
        'Chave normalizada do parâmetro. Usa uma da lista dada quando o parâmetro for o mesmo; senão cria uma em inglês, minúsculas e _ (ex: vitamin_b6).',
    },
    name: { type: 'string', description: 'O nome tal como vem no relatório.' },
    section: {
      type: ['string', 'null'],
      description: 'A secção (ex: Sangue, Urina).',
    },
    group: {
      type: ['string', 'null'],
      description:
        'O grupo dentro da secção, se houver (ex: Eritrograma, Leucograma, Sedimento urinário).',
    },
    value: {
      type: ['number', 'null'],
      description:
        'O valor numérico, ou null se o resultado for de texto ou tiver sinal (<15).',
    },
    valueText: {
      type: ['string', 'null'],
      description:
        'O resultado como texto quando não é um número simples (ex: "Ausente", "Amarela", "<15", "Contém(+--)").',
    },
    unit: { type: ['string', 'null'] },
    refLow: {
      type: ['number', 'null'],
      description: 'Limite inferior da referência.',
    },
    refHigh: {
      type: ['number', 'null'],
      description: 'Limite superior da referência (em "<200", é 200).',
    },
    refText: {
      type: ['string', 'null'],
      description:
        'A referência tal como vem escrita (ex: "13.2-16.6", "<200").',
    },
    flag: {
      type: ['string', 'null'],
      enum: ['ABNORMAL', null],
      description:
        'ABNORMAL só para resultados de texto fora do normal (ex: hemoglobina na urina "Contém" quando devia ser ausente).',
    },
  },
  required: [
    'key',
    'name',
    'value',
    'valueText',
    'unit',
    'refLow',
    'refHigh',
    'refText',
  ],
};

const SYSTEM_PROMPT =
  'Lês relatórios de análises clínicas e passas os resultados para dados estruturados com a ferramenta ' +
  `${TOOL_NAME}. Regras: ` +
  '1) Copia apenas resultados de análises — nunca nome, morada, números de utente ou de beneficiário, médicos ou assinaturas. ' +
  '2) Um registo por parâmetro, incluindo os de texto (urina: cor, aspeto, proteínas…). ' +
  '3) Os números podem usar ponto ou vírgula como separador decimal; decide pelo intervalo de referência (ex: Leucócitos "7.800" com referência "3.400-9.600" é 7.8, não 7800). ' +
  '4) Quando um parâmetro vem em percentagem e em valor absoluto na mesma linha (ex: Neutrófilos 52.9 % = 4.120 x10^9/L), cria dois registos: a percentagem com a chave _pct e o absoluto com a referência que tiver. ' +
  '5) Ignora notas, explicações, métodos de análise e resultados históricos de outras datas. ' +
  '6) collectedAt é a data da colheita em AAAA-MM-DD. ' +
  `Chaves normalizadas conhecidas: ${Object.entries(LAB_ANALYTES)
    .map(([key, name]) => `${key} (${name})`)
    .join(', ')}.`;

/**
 * Lê um PDF de análises com o Claude e devolve os resultados por parâmetro, já
 * com a marca de fora da referência. Não guarda nada: o utilizador revê antes.
 */
export async function extractLabReport(
  anthropic: AiClient,
  pdf: Buffer,
): Promise<ExtractedLabReport> {
  const response = await anthropic.messages.create({
    model: SUBAGENT_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: TOOL_NAME,
        description: 'Guarda os resultados lidos do relatório de análises.',
        input_schema: {
          type: 'object',
          properties: {
            lab: {
              type: ['string', 'null'],
              description:
                'O laboratório (ex: Unilabs, Synlab, Germano de Sousa).',
            },
            collectedAt: {
              type: ['string', 'null'],
              description: 'Data da colheita, AAAA-MM-DD.',
            },
            results: { type: 'array', items: RESULT_SCHEMA },
          },
          required: ['lab', 'collectedAt', 'results'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdf.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extrai os resultados deste relatório de análises.',
          },
        ],
      },
    ],
  });

  const call = response.content.find((block) => block.type === 'tool_use');
  const input = (
    call?.type === 'tool_use' ? call.input : {}
  ) as Partial<ExtractedLabReport>;

  return {
    lab: input.lab?.trim() || null,
    collectedAt: /^\d{4}-\d{2}-\d{2}$/.test(input.collectedAt ?? '')
      ? (input.collectedAt as string)
      : null,
    results: (Array.isArray(input.results) ? input.results : [])
      .filter((result) => result?.name)
      .map((result) => {
        const normalized = {
          key: analyteKey(result.key || result.name),
          name: String(result.name).trim(),
          section: result.section?.trim() || null,
          group: result.group?.trim() || null,
          value: typeof result.value === 'number' ? result.value : null,
          valueText: result.valueText?.trim() || null,
          unit: result.unit?.trim() || null,
          refLow: typeof result.refLow === 'number' ? result.refLow : null,
          refHigh: typeof result.refHigh === 'number' ? result.refHigh : null,
          refText: result.refText?.trim() || null,
          flag: result.flag ?? null,
        };
        return { ...normalized, flag: labFlag(normalized) };
      }),
  };
}
