import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  HEALTH_METRICS,
  HealthMetric,
  healthDetail,
  healthMetric,
  healthOverview,
} from '../tools/healthTools';
import {
  HEALTH_LOG_KINDS,
  HealthLogInput,
  healthLog,
} from '../tools/healthLogTools';
import {
  HEALTH_CHANGE_ACTIONS,
  HEALTH_CHANGE_KINDS,
  HealthChangeInput,
  healthChange,
} from '../tools/healthChangeTools';

const METRIC_SCHEMA = {
  type: 'string' as const,
  enum: [...HEALTH_METRICS],
  description:
    'A métrica: sleep (sono), heart_rate (batimento), skin_temperature (temperatura da ' +
    'pele), blood_oxygen (oxigénio/SpO2), stress, steps (passos), exercise (treinos), ' +
    'weight (peso, registado à mão), water (água bebida, registada à mão), labs (análises ' +
    'clínicas), medication (medicação), diary (diário de dores, sintomas, alergias, registos do dia e notas), ' +
    'nutrition (refeições), intakes (cafés, álcool e suplementos, com limites), body (medidas do corpo), vitals (tensão, ' +
    'glicemia e temperatura), training (treinos do openGym com os exercícios e as séries), mood (humor, energia e motivação), ' +
    'fasting (jejuns) ou medical (consultas, vacinas, exames, doenças, visão).',
};

// As definições das ferramentas são fixas (o caching vive do prefixo igual); o
// utilizador só entra pelos handlers, que leem apenas os dados dele.
export function buildHealthTools(context: AgentContext): AgentTool[] {
  const { userId, health } = context;

  return [
    {
      name: 'health_overview',
      description:
        'Visão geral da saúde do utilizador: as médias dos últimos 7 e 30 dias de todas as ' +
        'métricas importadas (sono, batimento, temperatura da pele, oxigénio, stress, passos e ' +
        'treinos) e o último dia importado de cada uma.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => healthOverview(health, userId),
    },
    {
      name: 'health_metric',
      description:
        'Uma métrica num período: as médias do período e uma linha por dia (por noite no sono, ' +
        'por treino no exercício), com o id de cada uma para o health_detail. Os períodos ' +
        'contam a partir do último dia importado.',
      inputSchema: {
        type: 'object',
        properties: {
          metric: METRIC_SCHEMA,
          days: {
            type: 'number',
            description:
              'Quantos dias para trás a partir do último importado (ex: 7, 30, 90, 365). 0 = tudo. Por omissão 30.',
          },
        },
        required: ['metric'],
      },
      handler: (input: { metric: HealthMetric; days?: number }) =>
        healthMetric(health, userId, input.metric, input.days),
    },
    {
      name: 'health_detail',
      description:
        'O detalhe de uma noite (fases pela ordem), de um dia (batimento, temperatura, ' +
        'oxigénio, stress ou passos hora a hora) ou de um treino (resumo, zonas de esforço, ' +
        'ritmo por km, batimento ao longo do treino e o que as outras métricas mediram). ' +
        'Precisa do id que vem no health_metric.',
      inputSchema: {
        type: 'object',
        properties: {
          metric: METRIC_SCHEMA,
          id: {
            type: 'string',
            description:
              'O id da noite, do dia ou do treino, tal como aparece no health_metric.',
          },
        },
        required: ['metric', 'id'],
      },
      handler: (input: { metric: HealthMetric; id: string }) =>
        healthDetail(health, userId, input.metric, input.id),
    },
    {
      name: 'health_log',
      description:
        'Regista uma coisa de saúde que o utilizador disse (no site ou na app): água, ' +
        'peso, uma entrada do diário (dor, sintoma, alergia, o dia, nota), uma refeição, um ' +
        'café ou bebida alcoólica (de preferência por um predefinido: "tomei um expresso" = preset ' +
        'espresso), o humor do dia, uma medição (tensão, glicemia, temperatura), começar/acabar um ' +
        'jejum, um treino simples (workout: tipo, horas ou duração, notas — os exercícios e as séries ' +
        'vêm do openGym, não se registam aqui) ou uma ' +
        'alergia ou doença crónica do perfil (condition: name, conditionKind, status, severity, date = ' +
        'desde quando, reaction, treatment, text = notas) ou um medicamento, vitamina ou suplemento novo ' +
        '(medication: medicationKind, name = o nome do produto, brand = a marca, substance = o que tem, ' +
        'doseAmount, doseUnit, times HH:MM ou timesPerDay, date = início (hoje por omissão), endDate, ' +
        'condition = o nome ou id da alergia/doença para que se toma, text = notas). Os treinos ' +
        'cruzam-se sozinhos com o batimento importado. Sem date/time fica agora; date, time e ' +
        'endTime são a hora local de Portugal. Devolve o que ficou guardado ou o erro.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...HEALTH_LOG_KINDS] },
          date: { type: 'string', description: 'AAAA-MM-DD, se não for hoje.' },
          time: {
            type: 'string',
            description: 'HH:MM, se o utilizador disse a hora.',
          },
          ml: {
            type: 'number',
            description: 'water: mililitros (um copo ~250).',
          },
          weightKg: { type: 'number', description: 'weight: kg.' },
          diaryKind: {
            type: 'string',
            enum: ['PAIN', 'SYMPTOM', 'ALLERGY', 'DAY', 'NOTE'],
            description: 'diary: o tipo.',
          },
          bodyArea: {
            type: 'string',
            description:
              'diary PAIN: head, neck, shoulders, chest, back_upper, back_lower, abdomen, arms, hands, hips, legs, knees, feet, teeth, other. ' +
              'ALLERGY: skin, eyes, nose, throat, mouth, breathing, stomach, other.',
          },
          intensity: {
            type: 'number',
            description: 'diary PAIN/SYMPTOM/ALLERGY: 0–10.',
          },
          trigger: {
            type: 'string',
            description: 'diary ALLERGY: a causa suspeita.',
          },
          text: {
            type: 'string',
            description:
              'O texto: a descrição do diário (obrigatório em NOTE e DAY), o que comeu (meal), a nota do humor ou da medição.',
          },
          mealType: {
            type: 'string',
            enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
          },
          kcal: {
            type: 'number',
            description: 'meal: a tua estimativa das calorias.',
          },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
          intakeKind: {
            type: 'string',
            enum: ['CAFFEINE', 'ALCOHOL'],
          },
          preset: {
            type: 'string',
            description:
              'intake: o predefinido do site (id ou nome). Café: espresso, double_espresso, abatanado, pingado, galao, meia_de_leite, cappuccino, filter_coffee, instant_coffee, decaf, black_tea, green_tea, cola, energy_drink, energy_drink_large, pre_workout, caffeine_pill. ' +
              'Álcool: beer_imperial, beer_mini, beer_bottle, beer_pint, beer_craft, beer_free, cider, wine_glass, wine_green, sparkling, port, sangria, spirit_shot, whisky, gin_tonic, cocktail, liqueur. ' +
              'Os valores (cafeína, álcool) vêm do predefinido; só mandes os totais se o utilizador disser outros. ' +
              'Vitaminas e suplementos não são intake: vão para a medicação (kind medication).',
          },
          quantity: {
            type: 'number',
            description: 'intake: quantas doses (2 cafés = 2). Por omissão 1.',
          },
          name: {
            type: 'string',
            description:
              'intake sem predefinido: o nome (com intakeKind e os totais).',
          },
          volumeMl: { type: 'number', description: 'intake: ml no total.' },
          caffeineMg: {
            type: 'number',
            description: 'intake: mg de cafeína no total.',
          },
          alcoholG: {
            type: 'number',
            description:
              'intake: gramas de álcool puro no total (ml × %vol × 0,789; 10 g = 1 bebida padrão).',
          },
          workoutType: {
            type: 'string',
            description:
              'workout: o tipo de treino (strength por omissão; gym, core, hiit, functional, stretching, yoga, running, walking, cycling, swimming…).',
          },
          endTime: {
            type: 'string',
            description: 'workout: HH:MM a que acabou.',
          },
          durationMin: {
            type: 'number',
            description: 'workout: minutos, se não disser a hora de fim.',
          },
          difficulty: {
            type: 'number',
            description: 'workout: quão difícil foi, 0–10.',
          },
          calories: {
            type: 'number',
            description:
              'workout: só se o utilizador disser (senão estimam-se pelo batimento).',
          },
          mood: { type: 'number', description: 'mood: 1–5.' },
          energy: { type: 'number', description: 'mood: 1–5.' },
          motivation: { type: 'number', description: 'mood: 1–5.' },
          vitalKind: {
            type: 'string',
            enum: ['BLOOD_PRESSURE', 'GLUCOSE', 'TEMPERATURE'],
          },
          value: {
            type: 'number',
            description:
              'vital: sistólica em mmHg ("12/8" = 120/80), glicemia em mg/dL ou temperatura em °C.',
          },
          value2: {
            type: 'number',
            description: 'vital BLOOD_PRESSURE: diastólica em mmHg.',
          },
          pulse: { type: 'number' },
          context: {
            type: 'string',
            enum: ['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM'],
            description: 'vital GLUCOSE.',
          },
          targetHours: {
            type: 'number',
            description: 'fast_start: objetivo em horas (16 por omissão).',
          },
          conditionKind: {
            type: 'string',
            enum: ['ALLERGY', 'CONDITION'],
            description: 'condition: alergia ou doença crónica.',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'TREATING', 'CONTROLLED', 'RESOLVED'],
            description:
              'condition: ativa sem tratamento, em tratamento, controlada ou tratada (ACTIVE por omissão).',
          },
          severity: { type: 'string', enum: ['MILD', 'MODERATE', 'SEVERE'] },
          reaction: {
            type: 'string',
            description: 'condition ALLERGY: o que provoca.',
          },
          treatment: {
            type: 'string',
            description: 'condition: como se trata ou tratou.',
          },
          medicationKind: {
            type: 'string',
            enum: ['MEDICATION', 'VITAMIN', 'SUPPLEMENT'],
            description:
              'medication: medicamento, vitamina ou suplemento (creatina, whey, ómega-3, magnésio…). MEDICATION por omissão.',
          },
          brand: { type: 'string', description: 'medication: a marca.' },
          substance: {
            type: 'string',
            description:
              'medication: o que tem, quando o nome é o do produto (ex: name "D-Vitum Forte", substance "Vitamina D3").',
          },
          doseAmount: {
            type: 'number',
            description:
              'medication: a dose de cada toma (ex: 2000 com doseUnit iu, ou 1 com capsule).',
          },
          doseUnit: {
            type: 'string',
            enum: ['mg', 'g', 'mcg', 'ml', 'tablet', 'capsule', 'drops', 'iu'],
            description: 'medication: a unidade da dose.',
          },
          times: {
            type: 'array',
            items: { type: 'string' },
            description: 'medication: as horas das tomas (HH:MM).',
          },
          timesPerDay: {
            type: 'number',
            description: 'medication: tomas por dia, quando não há hora certa.',
          },
          endDate: {
            type: 'string',
            description: 'medication: até quando (AAAA-MM-DD), se já se sabe.',
          },
          condition: {
            type: 'string',
            description:
              'medication: a alergia ou doença do perfil para que se toma (nome ou id).',
          },
        },
        required: ['kind'],
      },
      handler: (input: HealthLogInput) => healthLog(health, userId, input),
    },
    {
      name: 'health_change',
      description:
        'Muda ou apaga um registo de saúde pelo id (que vem no health_metric), ou volta a cruzar os ' +
        'treinos manuais e do openGym com o batimento importado (action sync, kind workout; sem id = todos). ' +
        'Alterações (update): intake (quantity, name, at, notes ou os totais), mood (o id é o dia ' +
        'AAAA-MM-DD; mood, energy, motivation, note), fast (startAt, endAt, targetHours, notes), ' +
        'medication (endDate AAAA-MM-DD para "deixei de tomar", startDate, kind MEDICATION/VITAMIN/SUPPLEMENT, ' +
        'brand, substance, doseAmount, doseUnit, ' +
        'times, timesPerDay, notes, name, conditionId = o id da alergia ou doença para que se toma, ou ' +
        'null), condition (name, status, severity, since, resolvedAt, reaction, treatment, notes), ' +
        'workout (sessões: parentId = o id do treino principal e partRole WARMUP aquecimento, COOLDOWN ' +
        'retorno à calma ou PART parte; parentId null separa), vital (as medições de tensão, glicemia e temperatura: value, ' +
        'value2, pulse, context, notes, at; o id vem no health_metric vitals e muda ao corrigir) e ' +
        'profile (sem id: heightCm, birthDate AAAA-MM-DD, sex MALE/FEMALE/OTHER, bloodType, fullName, ' +
        'emergencyContact, notes). Só mudam os campos que vierem. Apagar (delete) funciona em todos os ' +
        'tipos menos profile. ' +
        'Antes de apagar confirma com o utilizador se houver dúvida sobre qual é.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: [...HEALTH_CHANGE_ACTIONS] },
          kind: { type: 'string', enum: [...HEALTH_CHANGE_KINDS] },
          id: { type: 'string' },
          fields: {
            type: 'object',
            description: 'update: os campos a mudar.',
          },
        },
        required: ['action', 'kind'],
      },
      handler: (input: HealthChangeInput) =>
        healthChange(health, userId, input),
    },
  ];
}
