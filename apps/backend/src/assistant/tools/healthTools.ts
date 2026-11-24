import { HealthService } from 'src/health/health.service';
import { HeartRateService } from 'src/health/heart-rate.service';
import { SkinTemperatureService } from 'src/health/skin-temperature.service';
import { BloodOxygenService } from 'src/health/blood-oxygen.service';
import { StressService } from 'src/health/stress.service';
import { StepsService } from 'src/health/steps.service';
import { ExerciseService } from 'src/health/exercise.service';
import { WeightService } from 'src/health/weight.service';
import { WaterService } from 'src/health/water.service';
import { LabsService } from 'src/health/labs.service';
import { HealthRecordsService } from 'src/health/health-records.service';
import { NutritionService } from 'src/health/nutrition.service';
import { BodyService } from 'src/health/body.service';
import { WellbeingService } from 'src/health/wellbeing.service';
import { MedicalService } from 'src/health/medical.service';
import { IntakesService } from 'src/health/intakes.service';
import { localMinute } from 'src/health/helpers/timeZone';
import { COMPOSITION_FIELDS } from 'src/health/helpers/healthMetrics';
import { JOURNAL_METRICS, journalMetric } from './healthJournalTools';

/** Os serviços de saúde que o agente de saúde usa, sempre com os dados do próprio utilizador. */
export interface HealthServices {
  sleep: HealthService;
  heart: HeartRateService;
  skin: SkinTemperatureService;
  oxygen: BloodOxygenService;
  stress: StressService;
  steps: StepsService;
  exercise: ExerciseService;
  weight: WeightService;
  water: WaterService;
  labs: LabsService;
  records: HealthRecordsService;
  nutrition: NutritionService;
  body: BodyService;
  wellbeing: WellbeingService;
  medical: MedicalService;
  intakes: IntakesService;
}

export const HEALTH_METRICS = [
  'sleep',
  'heart_rate',
  'skin_temperature',
  'blood_oxygen',
  'stress',
  'steps',
  'exercise',
  'weight',
  'water',
  'labs',
  'medication',
  'diary',
  ...JOURNAL_METRICS,
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];

/** Para não encher o contexto: as médias cobrem o período todo, a lista só os dias mais recentes. */
const MAX_ROWS = 120;

const NO_DATA =
  'Não há dados importados. O utilizador tem de importar o export do Huawei Health em Saúde → Adicionar dados de saúde.';

const pad = (value: number) => String(value).padStart(2, '0');

const clock = (
  time: Date | string | null | undefined,
  timeZone: string | null,
) => {
  if (!time) return '—';
  const minute = localMinute(new Date(time), timeZone);
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
};

const minuteClock = (minute: number | null | undefined) =>
  minute == null
    ? '—'
    : `${pad(Math.floor(minute / 60) % 24)}:${pad(minute % 60)}`;

const duration = (minutes: number | null | undefined) => {
  if (minutes == null) return '—';
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h${pad(rounded % 60)}`;
};

const value = (input: number | null | undefined, unit = '') =>
  input == null ? '—' : `${input}${unit}`;

/** Campos internos da importação, que só ocupam espaço na resposta. */
const INTERNAL_FIELDS = new Set([
  'userId',
  'source',
  'externalId',
  'createdAt',
  'updatedAt',
]);

const json = (data: unknown) =>
  JSON.stringify(data, (key, input: unknown) =>
    INTERNAL_FIELDS.has(key) ? undefined : input,
  );

const rows = (lines: string[]) =>
  lines.length > MAX_ROWS
    ? [
        ...lines.slice(0, MAX_ROWS),
        `(mais ${lines.length - MAX_ROWS} registos antigos omitidos — pede um período mais curto para os veres)`,
      ]
    : lines;

const clampDays = (days: number | undefined) => {
  const parsed = Math.round(Number(days ?? 30));
  if (!Number.isFinite(parsed) || parsed < 0) return 30;
  return Math.min(parsed, 730);
};

/** As médias de 7 e 30 dias de todas as métricas, num só bloco. */
export async function healthOverview(services: HealthServices, userId: string) {
  const [overview, steps, exercise] = await Promise.all([
    services.sleep.summary(userId),
    services.steps.summary(userId),
    services.exercise.summary(userId),
  ]);
  const sections: string[] = [];
  const add = (title: string, data: unknown) => {
    if (data) sections.push(`${title}: ${json(data)}`);
  };

  add(
    'Sono',
    overview.sleep && {
      ultimaNoite: overview.sleep.latestNight.night,
      ultimos7: overview.sleep.last7,
      ultimos30: overview.sleep.last30,
    },
  );
  add(
    'Batimento',
    overview.heart && {
      ultimoDia: overview.heart.latestDay.day,
      ultimos7: overview.heart.last7,
      ultimos30: overview.heart.last30,
    },
  );
  add(
    'Temperatura da pele',
    overview.skinTemperature && {
      ultimoDia: overview.skinTemperature.latestDay.day,
      ultimos7: overview.skinTemperature.last7,
      ultimos30: overview.skinTemperature.last30,
    },
  );
  add(
    'Oxigénio no sangue',
    overview.bloodOxygen && {
      ultimoDia: overview.bloodOxygen.latestDay.day,
      ultimos7: overview.bloodOxygen.last7,
      ultimos30: overview.bloodOxygen.last30,
    },
  );
  add(
    'Stress',
    overview.stress && {
      ultimoDia: overview.stress.latestDay.day,
      ultimos7: overview.stress.last7,
      ultimos30: overview.stress.last30,
    },
  );
  add(
    'Passos',
    steps && {
      ultimoDia: steps.latestDay.day,
      ultimos7: steps.last7,
      ultimos30: steps.last30,
    },
  );
  add(
    'Exercício',
    exercise && {
      ultimoTreino: exercise.latestDay,
      ultimos7: exercise.last7,
      ultimos30: exercise.last30,
    },
  );
  add(
    'Peso (registado à mão, kg)',
    overview.weight && {
      ultimaPesagem: overview.weight.latestDay,
      ultimos7: overview.weight.last7,
      ultimos30: overview.weight.last30,
    },
  );
  add(
    'Água (registada à mão, ml por dia)',
    overview.water && {
      ultimoDia: overview.water.latestDay,
      ultimos7: overview.water.last7,
      ultimos30: overview.water.last30,
    },
  );

  const [profile, conditions, medications, reports, diary] = await Promise.all([
    services.records.profile(userId),
    services.records.conditions(userId),
    services.records.medications(userId),
    services.labs.reports(userId),
    services.records.diary(userId, 7),
  ]);
  add(
    'Perfil',
    (profile.heightCm || profile.age != null) && {
      idade: profile.age,
      sexo: profile.sex,
      tipoSanguineo: profile.bloodType,
      alturaCm: profile.heightCm,
      ultimoPesoKg: profile.weightKg,
      imc: profile.bmi,
    },
  );
  add(
    'Alergias e doenças crónicas (estado: ACTIVE sem tratamento, TREATING em tratamento, CONTROLLED controlada, RESOLVED tratada)',
    conditions.length &&
      conditions.map((condition) => ({
        id: condition.id,
        tipo: condition.kind === 'ALLERGY' ? 'alergia' : 'doença',
        nome: condition.name,
        estado: condition.status,
        gravidade: condition.severity,
        desde: condition.since,
        tratadaEm: condition.resolvedAt,
        reacao: condition.reaction,
        tratamento: condition.treatment,
        medicamentos: condition.medications.map(
          (medication) => medication.name,
        ),
      })),
  );
  add(
    'Medicação, vitaminas e suplementos atuais',
    medications.some((medication) => medication.active) &&
      medications
        .filter((medication) => medication.active)
        .map((medication) => ({
          tipo: medication.kind,
          nome: medication.name,
          marca: medication.brand,
          tem: medication.substance,
          dose: medication.doseAmount,
          unidade: medication.doseUnit,
          porDia: medication.timesPerDay,
          horas: medication.times,
          para: medication.condition?.name ?? null,
        })),
  );
  add(
    'Análises (relatórios, do mais recente)',
    reports.length &&
      reports.slice(0, 5).map((report) => ({
        id: report.id,
        data: report.collectedAt,
        laboratorio: report.lab,
        resultados: report.results,
        foraDaReferencia: report.outOfRange,
      })),
  );
  const [nutrition, intakes, wellbeing, medical] = await Promise.all([
    services.nutrition.nutrition(userId, 7),
    services.intakes.intakes(userId, 7),
    services.wellbeing.wellbeing(
      userId,
      7,
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(
        new Date(),
      ),
    ),
    services.medical.medical(userId),
  ]);
  add(
    'Alimentação dos últimos 7 dias (médias por dia com refeições)',
    nutrition.averages.days > 0 && nutrition.averages,
  );
  add(
    'Cafés, álcool e suplementos dos últimos 7 dias (médias e limites)',
    intakes.entries.length > 0 && {
      medias: intakes.averages,
      limites: intakes.settings,
    },
  );
  add(
    'Humor dos últimos 7 dias (1–5)',
    wellbeing.moods.length > 0 && wellbeing.moods,
  );
  add('Médico: o que vem aí', medical.upcoming.length > 0 && medical.upcoming);
  add(
    'Diário dos últimos 7 dias (a contar de hoje)',
    diary.length && {
      entradas: diary.length,
      dores: diary.filter((entry) => entry.kind === 'PAIN').length,
      alergias: diary.filter((entry) => entry.kind === 'ALLERGY').length,
    },
  );

  if (!sections.length) return NO_DATA;
  return [
    'Médias de 7 e 30 dias, contadas a partir do último dia importado de cada métrica (não de hoje). Minutos em min, distâncias em m, calorias em kcal.',
    ...sections,
  ].join('\n');
}

/** As médias de uma métrica num período e a lista dos dias (ou noites, ou treinos), com o id para o detalhe. */
export async function healthMetric(
  services: HealthServices,
  userId: string,
  metric: HealthMetric,
  daysInput?: number,
) {
  const days = clampDays(daysInput);
  const period = days
    ? `últimos ${days} dias até ao último importado`
    : 'tudo o que foi importado';

  switch (metric) {
    case 'sleep': {
      const data = await services.sleep.sleep(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Sono (${period}). Médias: ${json(data.averages)}`,
        'Noites (data | id | adormeceu→acordou | sono | profundo/leve/REM/acordado em min | eficiência | latência | FC média | VFC | SpO2):',
        ...rows(
          data.sessions.map(
            (s) =>
              `${s.night}${s.isNap ? ' (sesta)' : ''} | ${s.id} | ${clock(s.asleepAt, s.timeZone)}→${clock(s.wakeAt, s.timeZone)} | ${duration(s.asleepMin)} | ${s.deepMin}/${s.lightMin}/${s.remMin}/${s.awakeMin} | ${value(s.efficiency, '%')} | ${value(s.latencyMin, 'min')} | ${value(s.avgHeartRate)} | ${value(s.avgHrv)} | ${value(s.avgSpo2, '%')}`,
          ),
        ),
      ].join('\n');
    }
    case 'heart_rate': {
      const data = await services.heart.days(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Batimento (${period}). Médias: ${json(data.averages)}`,
        'Dias (data | id | repouso | média | mín@hora | máx@hora | VFC | leituras | zonas <60/60-99/100-139/≥140):',
        ...rows(
          data.days.map((d) => {
            const zones = d.zones as Record<string, number>;
            return `${d.day} | ${d.id} | ${value(d.restingBpm)} | ${d.avgBpm} | ${d.minBpm}@${minuteClock(d.minAt)} | ${d.maxBpm}@${minuteClock(d.maxAt)} | ${value(d.avgHrv)} | ${d.samples} | ${zones?.low ?? 0}/${zones?.normal ?? 0}/${zones?.elevated ?? 0}/${zones?.high ?? 0}`;
          }),
        ),
      ].join('\n');
    }
    case 'skin_temperature': {
      const data = await services.skin.days(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Temperatura da pele em °C (${period}). Abaixo de 32 °C é quase sempre o relógio fora do pulso. Médias: ${json(data.averages)}`,
        'Dias (data | id | noite 00-06 | média | mín@hora | máx@hora | leituras):',
        ...rows(
          data.days.map(
            (d) =>
              `${d.day} | ${d.id} | ${value(d.nightAvg)} | ${d.avgTemp} | ${d.minTemp}@${minuteClock(d.minAt)} | ${d.maxTemp}@${minuteClock(d.maxAt)} | ${d.samples}`,
          ),
        ),
      ].join('\n');
    }
    case 'blood_oxygen': {
      const data = await services.oxygen.days(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Oxigénio no sangue em % (${period}). Médias: ${json(data.averages)}`,
        'Dias (data | id | média | noite 00-06 | mín@hora | máx | medições | faixas <90/90-94/95-97/98-100):',
        ...rows(
          data.days.map((d) => {
            const ranges = d.ranges as Record<string, number>;
            return `${d.day} | ${d.id} | ${d.avgSpo2} | ${value(d.nightAvg)} | ${d.minSpo2}@${minuteClock(d.minAt)} | ${d.maxSpo2} | ${d.samples} | ${ranges?.low ?? 0}/${ranges?.reduced ?? 0}/${ranges?.normal ?? 0}/${ranges?.high ?? 0}`;
          }),
        ),
      ].join('\n');
    }
    case 'stress': {
      const data = await services.stress.days(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Stress, pontuação Huawei 1-99 (${period}). Níveis: relaxado 1-29, normal 30-59, médio 60-79, alto 80-99. Médias: ${json(data.averages)}`,
        'Dias (data | id | média | mín@hora | máx@hora | medições | níveis relaxado/normal/médio/alto):',
        ...rows(
          data.days.map((d) => {
            const levels = d.levels as Record<string, number>;
            return `${d.day} | ${d.id} | ${d.avgScore} | ${d.minScore}@${minuteClock(d.minAt)} | ${d.maxScore}@${minuteClock(d.maxAt)} | ${d.samples} | ${levels?.relaxed ?? 0}/${levels?.normal ?? 0}/${levels?.medium ?? 0}/${levels?.high ?? 0}`;
          }),
        ),
      ].join('\n');
    }
    case 'steps': {
      const data = await services.steps.days(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Passos (${period}). Objetivo diário 10 000. Médias: ${json(data.averages)}`,
        'Dias (data | id | passos | distância m | kcal ativas | minutos ativos):',
        ...rows(
          data.days.map(
            (d) =>
              `${d.day} | ${d.id} | ${d.steps} | ${d.distanceM} | ${d.calories} | ${d.activeMinutes}`,
          ),
        ),
      ].join('\n');
    }
    case 'exercise': {
      const data = await services.exercise.exercise(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Treinos (${period}). O tipo é a chave do catálogo em inglês (walking, running, football, strength, core…). Origem: HUAWEI vem do relógio, OPENGYM vem do openGym (a app de ginásio: tem a rotina, os exercícios e as séries feitas, com peso, repetições ou segundos, pausas e recordes — no health_detail ou na métrica training do health_journal), MANUAL foi registado à mão (só tipo, duração e notas). Um treino do openGym à mesma hora de um da Huawei fica como parte (PART) dele. Zonas de esforço por batimento: leve <120, moderado 120-139, intenso 140-159, máximo ≥160. Sessões: um treino pode ser parte de outro (aquecimento WARMUP, retorno à calma COOLDOWN ou parte PART); nas médias a sessão conta como um treino do tipo do principal. Médias: ${json(data.averages)}`,
        `Exercícios feitos no período, nos treinos do openGym (treinos, séries sem aquecimento, total de repetições, total de segundos, peso máximo em kg, recordes): ${json(data.moves)}`,
        'Treinos (data hora | id | tipo | origem | duração | distância m | kcal | FC média/máx | efeito de treino | GPS | sessão):',
        ...rows(
          data.workouts.map(
            (w) =>
              `${w.day} ${clock(w.startAt, w.timeZone)} | ${w.id} | ${w.typeId} | ${w.source} | ${duration(w.durationSec / 60)} | ${value(w.distanceM)} | ${value(w.calories)} | ${value(w.avgHeartRate)}/${value(w.maxHeartRate)} | ${value(w.trainingEffect)} | ${w.hasRoute ? 'sim' : 'não'} | ${w.parentId ? `${w.partRole} de ${w.parentId}` : '—'}`,
          ),
        ),
      ].join('\n');
    }
    case 'weight': {
      const data = await services.weight.weight(userId, days);
      if (!data.entries.length) return NO_DATA;
      return [
        `Peso em kg, registado à mão (${period}). Médias do peso: ${json(data.averages)}`,
        `Pesagens — cada uma é uma medição (data hora | id | aparelho | kg | diferença para a anterior | ${COMPOSITION_FIELDS.join(' / ')}; % e kg como diz o nome, TMB em kcal, gordura visceral é um índice):`,
        ...rows(
          data.entries.map(
            (e) =>
              `${e.day} ${clock(e.measuredAt, e.timeZone)} | ${e.id} | ${e.device ?? '—'} | ${e.weightKg ?? '—'} | ${e.changeKg == null ? '—' : (e.changeKg > 0 ? '+' : '') + e.changeKg} | ${COMPOSITION_FIELDS.map((field) => e[field] ?? '—').join(' / ')}`,
          ),
        ),
      ].join('\n');
    }
    case 'water': {
      const data = await services.water.water(userId, days);
      if (!data.averages) return NO_DATA;
      return [
        `Água bebida em ml, registada à mão (${period}). Objetivo diário ${data.averages.goalMl} ml. As médias contam só os dias com registos. Médias: ${json(data.averages)}`,
        'Dias (data | total ml | registos hora ml [id]):',
        ...rows(
          data.days.map(
            (d) =>
              `${d.day} | ${d.ml} | ${d.entries.map((e) => `${clock(e.drankAt, e.timeZone)} ${e.ml} [${e.id}]`).join(', ')}`,
          ),
        ),
      ].join('\n');
    }
    case 'labs': {
      const [reports, parameters] = await Promise.all([
        services.labs.reports(userId),
        services.labs.parameters(userId),
      ]);
      if (!reports.length) return NO_DATA;
      return [
        'Análises clínicas (o período não se aplica: é tudo o que foi registado). Para o histórico de um parâmetro usa health_detail com a chave; para um relatório inteiro, com o id dele.',
        'Relatórios (data | id | laboratório | n.º de resultados | fora da referência):',
        ...reports.map(
          (r) =>
            `${r.collectedAt} | ${r.id} | ${r.lab ?? '—'} | ${r.results} | ${r.outOfRange}`,
        ),
        'Parâmetros com o valor mais recente (chave | nome | valor | referência | marca | data | n.º de medições):',
        ...rows(
          parameters.map(
            (p) =>
              `${p.key} | ${p.name} | ${p.value ?? p.valueText ?? '—'} ${p.unit ?? ''} | ${p.refText ?? '—'} | ${p.flag ?? ''} | ${p.date} | ${p.count}`,
          ),
        ),
      ].join('\n');
    }
    case 'medication': {
      const medications = await services.records.medications(userId);
      if (!medications.length) return 'Não há medicação registada.';
      return [
        'Medicação, vitaminas e suplementos (id | tipo | nome | marca | o que tem | dose | tomas por dia | horas | início → fim | a tomar agora | notas):',
        ...medications.map(
          (m) =>
            `${m.id} | ${m.kind} | ${m.name} | ${m.brand ?? '—'} | ${m.substance ?? '—'} | ${m.doseAmount ?? '—'} ${m.doseUnit ?? ''} | ${m.timesPerDay ?? '—'} | ${m.times.join(', ') || '—'} | ${m.startDate ?? '?'} → ${m.endDate ?? 'sem fim'} | ${m.active ? 'sim' : 'não'} | ${m.notes ?? ''}`,
        ),
      ].join('\n');
    }
    case 'diary': {
      const entries = await services.records.diary(userId, days);
      if (!entries.length) return 'Não há entradas no diário neste período.';
      return [
        `Diário de saúde (${days ? `últimos ${days} dias a contar de hoje` : 'tudo'}). Tipos: PAIN dor, SYMPTOM sintoma, ALLERGY alergia (zona onde se manifestou e causa suspeita), DAY registo do dia (o que comeu e fez), NOTE nota. Intensidade 0–10.`,
        'Entradas (data hora | id | tipo | zona | intensidade | causa suspeita | texto):',
        ...rows(
          entries.map(
            (e) =>
              `${e.day} ${clock(e.at, e.timeZone)} | ${e.id} | ${e.kind} | ${e.bodyArea ?? '—'} | ${e.intensity ?? '—'} | ${e.trigger ?? '—'} | ${e.text ?? ''}`,
          ),
        ),
      ].join('\n');
    }
    default:
      return journalMetric(services, userId, metric, days);
  }
}

/** Agrupa pontos [minuto do dia, valor] por hora: mín, média e máx de cada hora. */
const byHour = (points: unknown) => {
  const hours = new Map<number, number[]>();
  for (const [minute, reading] of (Array.isArray(points) ? points : []) as [
    number,
    number,
  ][]) {
    const hour = Math.floor(minute / 60);
    const list = hours.get(hour);
    if (list) list.push(reading);
    else hours.set(hour, [reading]);
  }
  return [...hours.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, values]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return `${pad(hour)}h ${Math.min(...values)}/${Math.round(mean * 10) / 10}/${Math.max(...values)}`;
    })
    .join('; ');
};

/** O detalhe de uma noite, de um dia ou de um treino, pelo id que vem em health_metric. */
export async function healthDetail(
  services: HealthServices,
  userId: string,
  metric: HealthMetric,
  id: string,
) {
  try {
    switch (metric) {
      case 'sleep': {
        const night = await services.sleep.sleepSession(userId, id);
        const stages =
          (night.stages as {
            stage: string;
            start: string;
            minutes: number;
          }[]) ?? [];
        return [
          `Noite ${night.night}${night.isNap ? ' (sesta)' : ''}: ${json({ ...night, stages: undefined })}`,
          `Fases pela ordem (hora local, fase, minutos): ${stages.map((s) => `${clock(s.start, night.timeZone)} ${s.stage} ${s.minutes}`).join('; ')}`,
        ].join('\n');
      }
      case 'heart_rate': {
        const day = await services.heart.day(userId, id);
        return [
          `Dia ${day.day}: ${json({ ...day, points: undefined, hrvPoints: undefined })}`,
          `Batimento por hora (mín/média/máx): ${byHour(day.points)}`,
          `VFC por hora (mín/média/máx): ${byHour(day.hrvPoints) || 'sem leituras'}`,
        ].join('\n');
      }
      case 'skin_temperature': {
        const day = await services.skin.day(userId, id);
        return [
          `Dia ${day.day}: ${json({ ...day, points: undefined })}`,
          `Temperatura por hora (mín/média/máx): ${byHour(day.points)}`,
        ].join('\n');
      }
      case 'blood_oxygen': {
        const day = await services.oxygen.day(userId, id);
        const points = (day.points as [number, number][]) ?? [];
        return [
          `Dia ${day.day}: ${json({ ...day, points: undefined })}`,
          `Medições (hora valor): ${points.map(([m, v]) => `${minuteClock(m)} ${v}`).join('; ')}`,
        ].join('\n');
      }
      case 'stress': {
        const day = await services.stress.day(userId, id);
        const points = (day.points as [number, number][]) ?? [];
        return [
          `Dia ${day.day}: ${json({ ...day, points: undefined })}`,
          `Medições (hora valor): ${points.map(([m, v]) => `${minuteClock(m)} ${v}`).join('; ')}`,
        ].join('\n');
      }
      case 'steps': {
        const day = await services.steps.day(userId, id);
        const hourly = (day.hourly as number[]) ?? [];
        return [
          `Dia ${day.day}: ${json({ ...day, hourly: undefined })}`,
          `Passos por hora: ${
            hourly
              .map((steps, hour) => `${pad(hour)}h ${steps}`)
              .filter((_, hour) => hourly[hour] > 0)
              .join('; ') || 'sem passos por hora'
          }`,
        ].join('\n');
      }
      case 'exercise': {
        const workout = await services.exercise.workout(userId, id);
        const heart = (workout.heartRate as [number, number][]) ?? [];
        const every5 = heart
          .filter((_, index) => index % 10 === 0)
          .map(([second, bpm]) => `${Math.round(second / 60)}′ ${bpm}`);
        return [
          `Treino: ${json({ ...workout, heartRate: undefined, cadence: undefined, altitude: undefined, route: undefined, context: undefined })}`,
          `Batimento ao longo do treino (minuto bpm, amostrado): ${every5.join('; ') || 'sem batimento'}`,
          `Durante o treino (outras métricas): ${json({ ...workout.context, skinTemperature: undefined, bloodOxygen: undefined, stress: undefined })}`,
          `Tem rota GPS: ${workout.route ? 'sim' : 'não'} (o mapa só se vê na app)`,
        ].join('\n');
      }
      case 'weight':
      case 'water':
      case 'medication':
      case 'diary':
      case 'nutrition':
      case 'body':
      case 'vitals':
      case 'training':
      case 'mood':
      case 'intakes':
      case 'fasting':
      case 'medical':
        return 'Esta métrica não tem detalhe: tudo o que há já vem no health_metric.';
      case 'labs': {
        // O id é o de um relatório ou a chave de um parâmetro (para o histórico).
        if (/^[0-9a-f-]{36}$/.test(id)) {
          const report = await services.labs.report(userId, id);
          return [
            `Relatório de ${report.collectedAt} (${report.lab ?? 'laboratório desconhecido'}):`,
            ...report.results.map(
              (r) =>
                `${r.section ?? ''} ${r.group ? `/ ${r.group}` : ''} | ${r.key} | ${r.name} | ${r.value ?? r.valueText ?? '—'} ${r.unit ?? ''} | ref ${r.refText ?? '—'} | ${r.flag ?? ''}`,
            ),
          ].join('\n');
        }
        const history = await services.labs.parameter(userId, id);
        return [
          `Histórico de ${history[history.length - 1].name} (${id}), do mais antigo para o mais recente:`,
          ...history.map(
            (r) =>
              `${r.date} | ${r.value ?? r.valueText ?? '—'} ${r.unit ?? ''} | ref ${r.refText ?? '—'} | ${r.flag ?? ''} | ${r.lab ?? ''}`,
          ),
        ].join('\n');
      }
    }
  } catch {
    return `Não encontrei esse registo (${metric}, ${id}). Usa health_metric para veres os ids.`;
  }
}
