import type { HealthServices } from './healthTools';
import { offsetMinutes } from 'src/health/helpers/timeZone';
import type {
  WorkoutExerciseLog,
  WorkoutSetLog,
} from 'src/health/opengym/openGymWorkoutData';

/** As métricas registadas à mão nas páginas novas de Saúde (contam a partir de hoje). */
export const JOURNAL_METRICS = [
  'nutrition',
  'intakes',
  'body',
  'vitals',
  'training',
  'mood',
  'fasting',
  'medical',
] as const;

export type JournalMetric = (typeof JOURNAL_METRICS)[number];

const MAX_ROWS = 120;

const rows = (lines: string[]) =>
  lines.length > MAX_ROWS
    ? [
        ...lines.slice(0, MAX_ROWS),
        `(mais ${lines.length - MAX_ROWS} registos antigos omitidos)`,
      ]
    : lines;

const dash = (value: string | number | null | undefined) =>
  value == null || value === '' ? '—' : String(value);

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(
    new Date(),
  );

/** Uma métrica do diário de saúde num período, em linhas de texto para o agente. */
export async function journalMetric(
  services: HealthServices,
  userId: string,
  metric: JournalMetric,
  days: number,
): Promise<string> {
  const period = days ? `últimos ${days} dias a contar de hoje` : 'tudo';

  switch (metric) {
    case 'nutrition': {
      const data = await services.nutrition.nutrition(userId, days);
      if (!data.meals.length)
        return 'Não há refeições registadas neste período (cafés e álcool estão na métrica intakes; vitaminas e suplementos na medication).';
      return [
        `Alimentação (${period}). kcal e macros em g são estimativas (do Claude ou metidas à mão). Álcool em bebidas padrão (10 g). Médias por dia com refeições: ${JSON.stringify(data.averages)}`,
        'Dias (data | refeições | kcal | proteína/hidratos/gordura g | cafeína mg | álcool un.):',
        ...rows(
          data.days.map(
            (d) =>
              `${d.day} | ${d.meals} | ${d.kcal} | ${d.proteinG}/${d.carbsG}/${d.fatG} | ${d.caffeineMg} | ${d.alcoholUnits}`,
          ),
        ),
        'Refeições (data | id | tipo | o que foi | kcal):',
        ...rows(
          data.meals.map(
            (m) =>
              `${m.day} | ${m.id} | ${m.mealType} | ${m.text} | ${dash(m.kcal)}`,
          ),
        ),
      ].join('\n');
    }
    case 'intakes': {
      const data = await services.intakes.intakes(userId, days);
      if (!data.entries.length)
        return `Não há cafés nem álcool registados neste período. Limites: ${JSON.stringify(data.settings)}`;
      return [
        `Cafés e álcool (${period}). Vitaminas e suplementos estão na medication. Cafeína em mg; álcool em gramas e em bebidas padrão (10 g). Limites do utilizador: ${JSON.stringify(data.settings)}. Médias do período: ${JSON.stringify(data.averages)}`,
        'Dias (data | cafeína mg | n.º com cafeína | álcool g | bebidas padrão):',
        ...rows(
          data.days.map(
            (d) =>
              `${d.day} | ${d.caffeineMg} | ${d.coffees} | ${d.alcoholG} | ${d.drinks}`,
          ),
        ),
        'Registos (data hora UTC | id | tipo | nome | predefinido | doses | ml | cafeína mg | álcool g | notas):',
        ...rows(
          data.entries.map(
            (e) =>
              `${e.at.toISOString()} | ${e.id} | ${e.kind} | ${e.name} | ${dash(e.presetId)} | ${e.quantity} | ${dash(e.volumeMl)} | ${dash(e.caffeineMg)} | ${dash(e.alcoholG)} | ${dash(e.notes)}`,
          ),
        ),
        `Itens próprios (id | tipo | nome): ${data.items.map((i) => `${i.id} | ${i.kind} | ${i.name}`).join('; ') || 'nenhum'}`,
      ].join('\n');
    }
    case 'body': {
      const data = await services.body.body(userId, days);
      if (!data.measurements.length && !data.photos.length)
        return 'Não há medidas do corpo registadas.';
      return [
        'Medidas do corpo (todas, em cm; a gordura e o músculo estão nas pesagens, no health_metric weight). Dia | cintura | peito | braço | coxa | anca | pescoço | notas:',
        ...rows(
          data.measurements.map(
            (m) =>
              `${m.day} | ${dash(m.waistCm)} | ${dash(m.chestCm)} | ${dash(m.armCm)} | ${dash(m.thighCm)} | ${dash(m.hipsCm)} | ${dash(m.neckCm)} | ${dash(m.notes)}`,
          ),
        ),
        `Fotos de progresso: ${data.photos.length} (só se veem na app).`,
      ].join('\n');
    }
    case 'vitals': {
      const data = await services.body.body(userId, days);
      if (!data.vitals.length)
        return 'Não há medições de tensão, glicemia ou temperatura neste período.';
      return [
        `Medições à mão (${period}). Tensão em mmHg (máxima/mínima) com pulso; glicemia em mg/dL (contexto FASTING jejum, BEFORE_MEAL, AFTER_MEAL, RANDOM); temperatura em °C.`,
        'Medições (data | id | tipo | valor | contexto | notas):',
        ...rows(
          data.vitals.map(
            (v) =>
              `${v.day} | ${v.id} | ${v.kind} | ${v.kind === 'BLOOD_PRESSURE' ? `${v.value}/${v.value2} pulso ${dash(v.pulse)}` : v.value} | ${dash(v.context)} | ${dash(v.notes)}`,
          ),
        ),
      ].join('\n');
    }
    case 'training': {
      const workouts = await services.exercise.gymWorkouts(userId, days);
      if (!workouts.length)
        return 'Não há treinos do openGym neste período (liga-se em Saúde → Importar dados de saúde → openGym).';
      const clock = (date: Date, timeZone: string | null) =>
        new Date(date.getTime() + offsetMinutes(timeZone) * 60_000)
          .toISOString()
          .slice(11, 16);
      const setText = (set: WorkoutSetLog) =>
        [
          set.warmup ? 'aquec.' : null,
          set.sec != null ? `${set.sec}s` : `${set.reps ?? '?'} reps`,
          set.weightKg ? `@${set.weightKg}kg` : null,
          set.rir != null ? `RIR ${set.rir}` : null,
          set.rpe != null ? `RPE ${set.rpe}` : null,
          set.restSec != null ? `pausa ${set.restSec}s` : null,
          set.done ? null : 'não feita',
        ]
          .filter(Boolean)
          .join(' ');
      return [
        `Treinos do openGym (${period}). Cada série: repetições ou segundos, peso, esforço (RIR/RPE) e a pausa desde a série anterior (nas de repetições inclui o tempo a fazê-las). FC e kcal vêm do batimento importado da Huawei, se houver.`,
        ...rows(
          workouts.flatMap((w) => [
            `${w.day.toISOString().slice(0, 10)} ${clock(w.startAt, w.timeZone)} | ${w.id} | ${dash(w.title)} | ${Math.round(w.durationSec / 60)} min | FC ${dash(w.avgHeartRate)}/${dash(w.maxHeartRate)} | ${dash(w.calories)} kcal | volume ${dash(w.volumeKg)} kg${w.parentId ? ` | parte de ${w.parentId}` : ''}`,
            ...(
              (w.exercises as unknown as WorkoutExerciseLog[] | null) ?? []
            ).map(
              (e) =>
                `  - ${e.name ?? e.id}${e.record ? ' (recorde)' : ''}: ${e.sets.map(setText).join('; ') || 'sem séries'}`,
            ),
          ]),
        ),
      ].join('\n');
    }
    case 'mood': {
      const data = await services.wellbeing.wellbeing(userId, days, today());
      if (!data.moods.length) return 'Não há humor registado neste período.';
      return [
        `Humor, energia e motivação de 1 a 5 (${period}).`,
        'Dias (data, que é também o id para alterar ou apagar | humor | energia | motivação | nota):',
        ...rows(
          data.moods.map(
            (m) =>
              `${m.day} | ${m.mood} | ${m.energy} | ${m.motivation} | ${dash(m.note)}`,
          ),
        ),
      ].join('\n');
    }
    case 'fasting': {
      const data = await services.wellbeing.wellbeing(userId, days, today());
      if (!data.fasts.length) return 'Não há jejuns registados.';
      return [
        'Jejuns (id | início | fim | horas | objetivo h | notas); sem fim = a decorrer:',
        ...rows(
          data.fasts.map(
            (f) =>
              `${f.id} | ${f.startAt.toISOString()} | ${f.endAt?.toISOString() ?? 'a decorrer'} | ${dash(f.hours)} | ${f.targetHours} | ${dash(f.notes)}`,
          ),
        ),
      ].join('\n');
    }
    case 'medical': {
      const data = await services.medical.medical(userId);
      return [
        'Histórico médico (tudo; o período não se aplica).',
        `O que vem aí (consultas, voltar ao médico, reforços, troca de lentes): ${JSON.stringify(data.upcoming)}`,
        'Consultas (data hora UTC | especialidade | médico | local | motivo | o que foi dito | voltar até):',
        ...rows(
          data.appointments.map(
            (a) =>
              `${a.at.toISOString()} | ${a.specialty} | ${dash(a.doctor)} | ${dash(a.place)} | ${dash(a.reason)} | ${dash(a.notes)} | ${dash(a.followUpDate)}`,
          ),
        ),
        'Vacinas (data | nome | dose | próximo reforço):',
        ...data.vaccines.map(
          (v) =>
            `${v.date} | ${v.name} | ${dash(v.dose)} | ${dash(v.nextDueDate)}`,
        ),
        'Exames (data | tipo | título | zona | conclusão | resumo):',
        ...data.exams.map(
          (e) =>
            `${e.date} | ${e.kind} | ${e.title} | ${dash(e.bodyPart)} | ${dash(e.findings)} | ${dash(e.summary)}`,
        ),
        'Doenças (início → fim | nome | sintomas | medicação | notas):',
        ...data.illnesses.map(
          (i) =>
            `${i.startDate} → ${dash(i.endDate)} | ${i.name} | ${dash(i.symptoms)} | ${dash(i.medication)} | ${dash(i.notes)}`,
        ),
        'Graduações (data | óculos/lentes | OD esf/cil/eixo | OE esf/cil/eixo | adição):',
        ...data.vision.map(
          (v) =>
            `${v.date} | ${v.kind} | ${dash(v.rightSphere)}/${dash(v.rightCylinder)}/${dash(v.rightAxis)} | ${dash(v.leftSphere)}/${dash(v.leftCylinder)}/${dash(v.leftAxis)} | ${dash(v.addition)}`,
        ),
        'Lentes de contacto (início | troca a | marca):',
        ...data.lenses.map(
          (l) => `${l.startDate} | ${l.replaceOn} | ${dash(l.brand)}`,
        ),
      ].join('\n');
    }
  }
}
