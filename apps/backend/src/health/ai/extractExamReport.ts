import type { AiClient } from 'src/ai-credential/ai-client';
import { SUBAGENT_MODEL } from 'src/assistant/claude-agent.client';
import { EXAM_KINDS } from '../dto/save-health-logs.dto';

export interface ExtractedExam {
  date: string | null;
  kind: string;
  title: string | null;
  bodyPart: string | null;
  findings: string | null;
  summary: string | null;
}

const TOOL_NAME = 'save_exam_report';

const SYSTEM_PROMPT =
  'Lês relatórios de exames médicos (radiografias, ecografias, TAC, ressonâncias, ECG, endoscopias) e ' +
  `passas o essencial para dados com a ferramenta ${TOOL_NAME}. Regras: ` +
  '1) Nunca copies nome, morada, números de utente, de processo ou de beneficiário, nem nomes de médicos ou assinaturas. ' +
  '2) findings é a conclusão ou a impressão diagnóstica do relatório, copiada fielmente (sem os dados pessoais). ' +
  '3) summary explica essa conclusão em 2 a 4 frases simples, em português de Portugal, para quem não é médico; ' +
  'não inventes nada que o relatório não diga e, se houver algo a vigiar, diz que convém falar com o médico. ' +
  '4) date é a data do exame em AAAA-MM-DD. ' +
  '5) title é o nome do exame (ex: Ecografia abdominal), bodyPart a zona (ex: Abdómen).';

/** Lê o PDF de um exame com o Claude. Não guarda nada: o utilizador revê antes. */
export async function extractExamReport(
  anthropic: AiClient,
  pdf: Buffer,
): Promise<ExtractedExam> {
  const response = await anthropic.messages.create({
    model: SUBAGENT_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: TOOL_NAME,
        description: 'Guarda o que se leu do relatório do exame.',
        input_schema: {
          type: 'object',
          properties: {
            date: { type: ['string', 'null'] },
            kind: { type: 'string', enum: [...EXAM_KINDS] },
            title: { type: ['string', 'null'] },
            bodyPart: { type: ['string', 'null'] },
            findings: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] },
          },
          required: [
            'date',
            'kind',
            'title',
            'bodyPart',
            'findings',
            'summary',
          ],
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
          { type: 'text', text: 'Lê este relatório de exame.' },
        ],
      },
    ],
  });

  const call = response.content.find((block) => block.type === 'tool_use');
  const input = (
    call?.type === 'tool_use' ? call.input : {}
  ) as Partial<ExtractedExam>;

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')
      ? (input.date as string)
      : null,
    kind: (EXAM_KINDS as readonly string[]).includes(input.kind ?? '')
      ? (input.kind as string)
      : 'OTHER',
    title: input.title?.trim() || null,
    bodyPart: input.bodyPart?.trim() || null,
    findings: input.findings?.trim() || null,
    summary: input.summary?.trim() || null,
  };
}
