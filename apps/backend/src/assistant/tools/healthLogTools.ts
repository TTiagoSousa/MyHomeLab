import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { HealthServices } from './healthTools';
import { SaveWaterDto } from 'src/health/dto/save-water.dto';
import { SaveWeightDto } from 'src/health/dto/save-weight.dto';
import {
  SaveDiaryEntryDto,
  SaveHealthConditionDto,
  SaveMedicationDto,
} from 'src/health/dto/save-health-records.dto';
import {
  SaveFastDto,
  SaveIntakeDto,
  SaveMealDto,
  SaveMoodDto,
  SaveVitalDto,
} from 'src/health/dto/save-health-logs.dto';
import { SaveManualWorkoutDto } from 'src/health/dto/save-manual-workout.dto';
import {
  INTAKE_PRESET_BY_ID,
  INTAKE_PRESETS,
} from 'src/health/helpers/intakePresets';

export const HEALTH_LOG_KINDS = [
  'water',
  'weight',
  'diary',
  'meal',
  'intake',
  'mood',
  'vital',
  'workout',
  'fast_start',
  'fast_end',
  'condition',
  'medication',
] as const;

export type HealthLogKind = (typeof HEALTH_LOG_KINDS)[number];

export interface HealthLogInput {
  kind: HealthLogKind;
  date?: string;
  time?: string;
  ml?: number;
  weightKg?: number;
  diaryKind?: string;
  bodyArea?: string;
  intensity?: number;
  trigger?: string;
  text?: string;
  mealType?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  intakeKind?: string;
  name?: string;
  mood?: number;
  energy?: number;
  motivation?: number;
  vitalKind?: string;
  value?: number;
  value2?: number;
  pulse?: number;
  context?: string;
  targetHours?: number;
  preset?: string;
  quantity?: number;
  volumeMl?: number;
  caffeineMg?: number;
  alcoholG?: number;
  workoutType?: string;
  endTime?: string;
  durationMin?: number;
  difficulty?: number;
  calories?: number;
  conditionKind?: string;
  status?: string;
  severity?: string;
  reaction?: string;
  treatment?: string;
  medicationKind?: string;
  brand?: string;
  substance?: string;
  doseAmount?: number;
  doseUnit?: string;
  times?: string[];
  timesPerDay?: number;
  endDate?: string;
  condition?: string;
}

const LISBON = 'Europe/Lisbon';

/** O desvio de Lisboa num instante, no formato da Huawei ("+0100"). */
const lisbonOffset = (date: Date) => {
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: LISBON,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return '+0000';
  return `${match[1]}${match[2].padStart(2, '0')}${match[3] ?? '00'}`;
};

const lisbonToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: LISBON }).format(new Date());

/** O instante a partir do dia e da hora locais de Portugal (por omissão, agora). */
const instantOf = (input: HealthLogInput) => {
  if (!input.date && !input.time) {
    const now = new Date();
    return { at: now, timeZone: lisbonOffset(now) };
  }
  const day = input.date ?? lisbonToday();
  const time = /^\d{2}:\d{2}$/.test(input.time ?? '') ? input.time : '12:00';
  const guess = new Date(`${day}T${time}:00Z`);
  const timeZone = lisbonOffset(guess);
  const sign = timeZone.startsWith('-') ? -1 : 1;
  const offset =
    sign * (Number(timeZone.slice(1, 3)) * 60 + Number(timeZone.slice(3, 5)));
  return { at: new Date(guess.getTime() - offset * 60_000), timeZone };
};

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** O predefinido pelo id, pelo nome ou por um dos outros nomes ("bica", "imperial"…). */
const findPreset = (text: string) => {
  const wanted = normalize(text);
  return (
    INTAKE_PRESET_BY_ID.get(text) ??
    INTAKE_PRESETS.find(
      (preset) =>
        normalize(preset.name) === wanted ||
        preset.aliases.some((alias) => normalize(alias) === wanted),
    ) ??
    null
  );
};

const syncText = (sync: { heart: boolean; calories: boolean }) =>
  sync.heart
    ? `Juntei o batimento do relógio nesse intervalo${sync.calories ? ' e estimei as calorias' : ''}.`
    : 'Ainda não há batimento importado para esse intervalo (junta-se sozinho quando o importar).';

const need = (value: unknown, what: string) => {
  if (value == null || value === '') throw new Error(`Falta ${what}.`);
};

/** As mesmas regras dos formulários do site: o agente não escreve o que a página recusaria. */
async function checked<T extends object>(
  dto: new () => T,
  data: Record<string, unknown>,
): Promise<T> {
  const instance = plainToInstance(dto, data);
  const errors = await validate(instance);
  if (errors.length) {
    throw new Error(
      errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; '),
    );
  }
  return instance;
}

/**
 * Regista uma coisa de saúde a partir de uma conversa (no site ou na app).
 * Devolve uma frase com o que ficou guardado, ou o erro para o agente corrigir.
 */
export async function healthLog(
  services: HealthServices,
  userId: string,
  input: HealthLogInput,
): Promise<string> {
  try {
    const { at, timeZone } = instantOf(input);
    const when = { at: at.toISOString(), timeZone };
    const day = input.date ?? lisbonToday();

    switch (input.kind) {
      case 'water': {
        need(input.ml, 'a quantidade em ml');
        await services.water.create(
          userId,
          await checked(SaveWaterDto, {
            ml: Math.round(input.ml!),
            drankAt: when.at,
            timeZone,
          }),
        );
        return `Registado: ${input.ml} ml de água.`;
      }
      case 'weight': {
        need(input.weightKg, 'o peso em kg');
        await services.weight.create(
          userId,
          await checked(SaveWeightDto, {
            weightKg: Math.round(input.weightKg! * 100) / 100,
            measuredAt: when.at,
            timeZone,
          }),
        );
        return `Registado: ${input.weightKg} kg.`;
      }
      case 'diary': {
        need(input.diaryKind, 'o tipo da entrada do diário');
        const entry = await services.records.createDiaryEntry(
          userId,
          await checked(SaveDiaryEntryDto, {
            ...when,
            kind: input.diaryKind!,
            bodyArea: input.bodyArea ?? null,
            intensity: input.intensity ?? null,
            trigger: input.trigger ?? null,
            text: input.text ?? null,
          }),
        );
        return `Registado no diário: ${entry.kind}${entry.bodyArea ? ` (${entry.bodyArea})` : ''}${entry.intensity != null ? `, ${entry.intensity}/10` : ''} a ${entry.day}.`;
      }
      case 'meal': {
        need(input.text, 'o que comeu');
        const round = (grams?: number) =>
          grams != null ? Math.round(grams * 10) / 10 : null;
        const meal = await services.nutrition.createMeal(
          userId,
          await checked(SaveMealDto, {
            ...when,
            mealType: input.mealType ?? 'SNACK',
            text: input.text!,
            kcal: input.kcal != null ? Math.round(input.kcal) : null,
            proteinG: round(input.proteinG),
            carbsG: round(input.carbsG),
            fatG: round(input.fatG),
            estimated: input.kcal != null,
          }),
        );
        return `Registada a refeição (${meal.mealType}) a ${meal.day}${meal.kcal != null ? `, ~${meal.kcal} kcal estimadas` : ''}.`;
      }
      case 'intake': {
        const preset = input.preset ? findPreset(input.preset) : null;
        if (input.preset && !preset && !input.intakeKind) {
          return `Não encontrei o predefinido "${input.preset}". Os que existem: ${INTAKE_PRESETS.map((p) => `${p.id} (${p.name})`).join(', ')}. Usa um deles ou manda intakeKind e name.`;
        }
        if (!preset) {
          need(input.intakeKind, 'o tipo (CAFFEINE ou ALCOHOL)');
          need(input.name ?? input.preset, 'o nome');
        }
        const entry = await services.intakes.create(
          userId,
          await checked(SaveIntakeDto, {
            ...when,
            presetId: preset?.id ?? null,
            kind: preset ? undefined : input.intakeKind,
            name: preset ? undefined : (input.name ?? input.preset),
            quantity: input.quantity ?? 1,
            volumeMl: input.volumeMl,
            caffeineMg: input.caffeineMg,
            alcoholG: input.alcoholG,
            notes: input.text ?? null,
          }),
        );
        const totals = [
          entry.caffeineMg != null && `${entry.caffeineMg} mg de cafeína`,
          entry.drinks != null && `${entry.drinks} bebidas padrão`,
        ].filter(Boolean);
        return `Registado: ${entry.quantity !== 1 ? `${entry.quantity}× ` : ''}${entry.name} a ${entry.day}${totals.length ? ` (${totals.join(', ')})` : ''}. id ${entry.id}.`;
      }
      case 'workout': {
        const end = input.endTime
          ? instantOf({ ...input, time: input.endTime })
          : null;
        const result = await services.exercise.createManual(
          userId,
          await checked(SaveManualWorkoutDto, {
            typeId: input.workoutType ?? 'strength',
            startAt: when.at,
            endAt: end?.at.toISOString() ?? null,
            timeZone,
            durationMin: input.durationMin ?? null,
            calories: input.calories ?? null,
            difficulty: input.difficulty ?? null,
            notes: input.text ?? null,
          }),
        );
        return `Registado o treino a ${day}. ${syncText(result.sync)} id ${result.id}.`;
      }
      case 'mood': {
        need(input.mood, 'o humor (1–5)');
        await services.wellbeing.saveMood(
          userId,
          day,
          await checked(SaveMoodDto, {
            mood: input.mood!,
            energy: input.energy ?? input.mood!,
            motivation: input.motivation ?? input.mood!,
            note: input.text ?? null,
          }),
        );
        return `Registado o humor de ${day}.`;
      }
      case 'vital': {
        need(input.vitalKind, 'o tipo de medição');
        need(input.value, 'o valor');
        await services.body.createVital(
          userId,
          await checked(SaveVitalDto, {
            ...when,
            kind: input.vitalKind!,
            value: input.value!,
            value2: input.value2 ?? null,
            pulse: input.pulse ?? null,
            context: input.context ?? null,
            notes: input.text ?? null,
          }),
        );
        return `Registada a medição (${input.vitalKind}): ${input.value}${input.value2 != null ? `/${input.value2}` : ''}.`;
      }
      case 'fast_start': {
        await services.wellbeing.createFast(
          userId,
          await checked(SaveFastDto, {
            startAt: when.at,
            targetHours: input.targetHours ?? 16,
          }),
        );
        return `Jejum começado (objetivo ${input.targetHours ?? 16} h).`;
      }
      case 'fast_end': {
        const data = await services.wellbeing.wellbeing(userId, 0, day);
        const open = data.fasts.find((fast) => !fast.endAt);
        if (!open) return 'Não há nenhum jejum a decorrer.';
        const ended = await services.wellbeing.updateFast(userId, open.id, {
          startAt: open.startAt.toISOString(),
          endAt: when.at,
          targetHours: open.targetHours,
          notes: open.notes,
        });
        return `Jejum terminado: ${ended.hours} h (objetivo ${ended.targetHours} h).`;
      }
      case 'condition': {
        need(input.name, 'o nome da alergia ou doença');
        const condition = await services.records.createCondition(
          userId,
          await checked(SaveHealthConditionDto, {
            kind: input.conditionKind ?? 'CONDITION',
            name: input.name!,
            status: input.status ?? 'ACTIVE',
            severity: input.severity ?? null,
            since: input.date ?? null,
            reaction: input.reaction ?? null,
            treatment: input.treatment ?? null,
            notes: input.text ?? null,
          }),
        );
        return `Guardado no perfil: ${condition.kind === 'ALLERGY' ? 'alergia' : 'doença'} "${condition.name}" (${condition.status}, id ${condition.id}).`;
      }
      case 'medication': {
        need(input.name, 'o nome do medicamento, vitamina ou suplemento');
        let conditionId: string | null = null;
        if (input.condition) {
          const conditions = await services.records.conditions(userId);
          const wanted = normalize(input.condition);
          const match =
            conditions.find((item) => item.id === input.condition) ??
            conditions.find((item) => normalize(item.name) === wanted) ??
            conditions.find((item) => normalize(item.name).includes(wanted));
          if (!match) {
            return conditions.length
              ? `Não encontrei "${input.condition}" nas alergias e doenças do perfil. Há: ${conditions.map((item) => `"${item.name}" (id ${item.id})`).join('; ')}. Pergunta ao utilizador qual é, ou regista-a primeiro com kind condition.`
              : `Não há alergias nem doenças no perfil. Regista "${input.condition}" primeiro com kind condition e depois o medicamento.`;
          }
          conditionId = match.id;
        }
        const medication = await services.records.createMedication(
          userId,
          await checked(SaveMedicationDto, {
            kind: input.medicationKind ?? 'MEDICATION',
            name: input.name!,
            brand: input.brand ?? null,
            substance: input.substance ?? null,
            doseAmount: input.doseAmount ?? null,
            doseUnit: input.doseUnit ?? null,
            times: input.times ?? [],
            timesPerDay: input.timesPerDay ?? null,
            startDate: input.date ?? lisbonToday(),
            endDate: input.endDate ?? null,
            notes: input.text ?? null,
            conditionId,
          }),
        );
        return `Guardado na medicação (${medication.kind}): "${medication.name}"${medication.condition ? ` (para ${medication.condition.name})` : ''}, id ${medication.id}.`;
      }
    }
  } catch (error) {
    const response = (error as { response?: { message?: string | string[] } })
      .response;
    const message: string | string[] =
      response?.message ??
      (error instanceof Error ? error.message : 'erro desconhecido');
    return `Não consegui registar: ${Array.isArray(message) ? message.join(' ') : message}`;
  }
}
