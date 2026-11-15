import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import {
  createRoutine,
  deleteRoutine,
  listRoutines,
  openGymTarget,
  overview,
  scheduleWeek,
  searchExercises,
  updateRoutine,
} from '../tools/openGymTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O openGym (nome ou endereço). Omite quando só há um.',
};

const EXERCISES = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'O id do catálogo, ex.: "0025".',
      },
      sets: { type: 'integer' },
      reps: { type: 'integer' },
      weight: { type: 'number' },
      rest_sec: {
        type: 'integer',
        description: 'Descanso entre séries, em segundos.',
      },
      seconds: {
        type: 'integer',
        description: 'Só nos que se seguram.',
      },
      minutes: { type: 'integer', description: 'Só no cardio.' },
      note: { type: 'string' },
    },
    required: ['id'],
  },
};

const DAYS = {
  type: 'array' as const,
  items: { type: 'integer' as const, minimum: 0, maximum: 6 },
  description: 'Dias da semana: 0 = domingo, 1 = segunda … 6 = sábado.',
};

// As definições são fixas (a cache vive do prefixo igual); o token só entra nos
// handlers, que leem apenas as contas deste utilizador.
export function buildOpenGymTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await openGymTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'opengym_overview',
      description:
        'Resumo do openGym (ginásio): versão, perfil, unidade (kg/lb), as rotinas, quantos treinos e o último, e o plano da semana.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'opengym_search_exercises',
      description:
        'Procura no catálogo de exercícios do openGym (mais de 5000, com nome em inglês e em português). Devolve o id de cada um, que é o que entra numa rotina. Procura em inglês quando em português não der nada.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: {
            type: 'string',
            description:
              'Palavras do nome, ex.: "bench press", "agachamento", "romanian deadlift".',
          },
          body_part: {
            type: 'string',
            description:
              'back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist ou full body.',
          },
          equipment: {
            type: 'string',
            description:
              'Ex.: barbell, dumbbell, cable, body weight, kettlebell, leverage machine, band.',
          },
          category: {
            type: 'string',
            description:
              'strength, calisthenics, cardio, stretching, mobility, plyometrics, isometric, yoga, olympic, pilates, rehab ou combat.',
          },
          limit: { type: 'integer', description: 'Até 50 (por omissão 20).' },
        },
      },
      handler: run(searchExercises),
    },
    {
      name: 'opengym_list_routines',
      description:
        'As rotinas (planos de treino) do openGym, com os exercícios, séries, repetições, peso e descanso de cada uma.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => listRoutines(account)),
    },
    {
      name: 'opengym_create_routine',
      description:
        'Cria uma rotina nova no openGym (não mexe nas que existem). Cada exercício é um id do catálogo (de opengym_search_exercises) com séries e repetições; peso na unidade do perfil; seconds para os que se seguram (prancha), minutes para cardio. Com days, marca-a nesses dias do plano da semana.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          name: { type: 'string', description: 'Ex.: "Peito e tríceps".' },
          emoji: { type: 'string', description: 'Opcional, ex.: 💪' },
          exercises: EXERCISES,
          days: DAYS,
        },
        required: ['name', 'exercises'],
      },
      handler: run(createRoutine),
    },
    {
      name: 'opengym_update_routine',
      description:
        'Muda uma rotina do openGym (pelo id ou pelo nome): o nome, o emoji e, com exercises, a lista inteira de exercícios (substitui a que lá estava; passa-os todos, com séries, repetições, peso e descanso). O resto da rotina fica.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          routine: { type: 'string', description: 'O id ou o nome da rotina.' },
          name: { type: 'string' },
          emoji: { type: 'string' },
          exercises: EXERCISES,
        },
        required: ['routine'],
      },
      handler: run(updateRoutine),
    },
    {
      name: 'opengym_delete_routine',
      description:
        'Apaga uma rotina do openGym e tira-a dos dias da semana. Os treinos já feitos com ela ficam. Só com confirm: true, quando ele pediu para a apagar.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          routine: { type: 'string', description: 'O id ou o nome da rotina.' },
          confirm: { type: 'boolean' },
        },
        required: ['routine'],
      },
      handler: run(deleteRoutine),
    },
    {
      name: 'opengym_schedule_week',
      description:
        'Marca rotinas que já existem nos dias do plano da semana do openGym (routine null = descanso). Só mexe nos dias que passares.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          plan: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 6,
                  description: '0 = domingo … 6 = sábado.',
                },
                routine: {
                  type: ['string', 'null'],
                  description: 'O nome ou o id da rotina; null para descanso.',
                },
              },
              required: ['day', 'routine'],
            },
          },
        },
        required: ['plan'],
      },
      handler: run(scheduleWeek),
    },
  ];
}
