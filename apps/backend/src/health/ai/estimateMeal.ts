import type Anthropic from '@anthropic-ai/sdk';
import type { AiClient } from 'src/ai-credential/ai-client';
import { SUBAGENT_MODEL } from 'src/assistant/claude-agent.client';

export interface MealEstimateItem {
  name: string;
  portion: string | null;
  kcal: number;
}

export interface MealEstimate {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  items: MealEstimateItem[];
  note: string | null;
}

export interface MealImage {
  buffer: Buffer;
  mimetype: string;
}

const TOOL_NAME = 'save_meal_estimate';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const SYSTEM_PROMPT =
  'Estimas as calorias e os macronutrientes de uma refeição a partir da descrição (e da foto, se houver), ' +
  `e respondes sempre com a ferramenta ${TOOL_NAME}. Regras: ` +
  '1) Quando a quantidade não é dita, assume uma porção normal de um adulto em Portugal. ' +
  '2) Separa a refeição nos alimentos principais, cada um com a porção que assumiste. ' +
  '3) Os totais são a soma dos alimentos; arredonda kcal a unidades e gramas a uma casa decimal. ' +
  '4) Em note, numa frase curta em português de Portugal, diz o que assumiste de mais incerto (ex: o molho, o tamanho do prato).';

const round1 = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;

/**
 * Estima as calorias e os macros de uma refeição com o Claude. É uma
 * estimativa: o utilizador revê os números antes de guardar.
 */
export async function estimateMeal(
  anthropic: AiClient,
  text: string,
  image?: MealImage | null,
): Promise<MealEstimate> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (image && IMAGE_TYPES.includes(image.mimetype)) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimetype as 'image/jpeg',
        data: image.buffer.toString('base64'),
      },
    });
  }
  content.push({ type: 'text', text: `Refeição: ${text}` });

  const response = await anthropic.messages.create({
    model: SUBAGENT_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: TOOL_NAME,
        description: 'Guarda a estimativa da refeição.',
        input_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  portion: {
                    type: ['string', 'null'],
                    description: 'A porção assumida (ex: 150 g, 1 prato).',
                  },
                  kcal: { type: 'number' },
                },
                required: ['name', 'portion', 'kcal'],
              },
            },
            kcal: { type: 'number' },
            proteinG: { type: 'number' },
            carbsG: { type: 'number' },
            fatG: { type: 'number' },
            note: { type: ['string', 'null'] },
          },
          required: ['items', 'kcal', 'proteinG', 'carbsG', 'fatG', 'note'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content }],
  });

  const call = response.content.find((block) => block.type === 'tool_use');
  const input = (
    call?.type === 'tool_use' ? call.input : {}
  ) as Partial<MealEstimate>;
  const kcal = round1(input.kcal);

  return {
    kcal: kcal == null ? null : Math.round(kcal),
    proteinG: round1(input.proteinG),
    carbsG: round1(input.carbsG),
    fatG: round1(input.fatG),
    items: (Array.isArray(input.items) ? input.items : [])
      .filter((item) => item?.name)
      .map((item) => ({
        name: String(item.name).trim(),
        portion: item.portion?.trim() || null,
        kcal: Math.round(Number(item.kcal) || 0),
      })),
    note: input.note?.trim() || null,
  };
}
