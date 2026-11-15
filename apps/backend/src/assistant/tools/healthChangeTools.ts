import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { HealthServices } from './healthTools';
import {
  SaveFastDto,
  SaveIntakeDto,
  SaveMoodDto,
  SaveVitalDto,
} from 'src/health/dto/save-health-logs.dto';
import {
  SaveHealthConditionDto,
  SaveHealthProfileDto,
  SaveMedicationDto,
} from 'src/health/dto/save-health-records.dto';
import { SetWorkoutPartsDto } from 'src/health/dto/set-workout-parts.dto';

export const HEALTH_CHANGE_ACTIONS = ['update', 'delete', 'sync'] as const;

export const HEALTH_CHANGE_KINDS = [
  'intake',
  'workout',
  'mood',
  'fast',
  'medication',
  'condition',
  'meal',
  'diary',
  'water',
  'weight',
  'vital',
  'profile',
] as const;

/** Os campos do perfil que se podem mudar pela conversa. */
const PROFILE_FIELDS = [
  'heightCm',
  'fullName',
  'birthDate',
  'sex',
  'bloodType',
  'emergencyContact',
  'notes',
] as const;

export interface HealthChangeInput {
  action: (typeof HEALTH_CHANGE_ACTIONS)[number];
  kind: (typeof HEALTH_CHANGE_KINDS)[number];
  id?: string;
  /** Os campos a mudar (os outros ficam como estão). */
  fields?: Record<string, unknown>;
}

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

const lisbonToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(
    new Date(),
  );

/**
 * Muda ou apaga um registo de saúde pelo id que vem no health_metric, ou volta
 * a cruzar os treinos manuais com o batimento importado. Nas alterações só
 * mudam os campos que vierem; o resto fica como estava.
 */
export async function healthChange(
  services: HealthServices,
  userId: string,
  input: HealthChangeInput,
): Promise<string> {
  try {
    const fields = input.fields ?? {};
    if (input.action === 'sync') {
      if (input.kind !== 'workout')
        return 'Só os treinos se cruzam com o batimento.';
      if (input.id) {
        const result = await services.exercise.syncManual(userId, input.id);
        return result.heart
          ? `Juntei o batimento ao treino${result.calories ? ' e estimei as calorias' : ''}.`
          : 'Não há batimento importado no intervalo desse treino (ou o treino não tem duração).';
      }
      const result = await services.exercise.syncAllHeartRate(userId);
      return `Verifiquei ${result.checked} treinos manuais: ${result.heart} com batimento, ${result.calories} com calorias estimadas.`;
    }
    // O perfil é um só por pessoa: não tem id nem se apaga.
    if (input.kind === 'profile') {
      if (input.action !== 'update')
        return 'O perfil não se apaga; muda só os campos (action update).';
      const changes = Object.fromEntries(
        PROFILE_FIELDS.filter((field) => fields[field] !== undefined).map(
          (field) => [field, fields[field]],
        ),
      );
      if (!Object.keys(changes).length) {
        return `Diz o que muda no perfil: ${PROFILE_FIELDS.join(', ')}.`;
      }
      const profile = await services.records.saveProfile(
        userId,
        await checked(SaveHealthProfileDto, changes),
      );
      return `Perfil alterado: altura ${profile.heightCm ?? '—'} cm, nascimento ${profile.birthDate ?? '—'}${profile.age != null ? ` (${profile.age} anos)` : ''}, sexo ${profile.sex ?? '—'}, tipo sanguíneo ${profile.bloodType ?? '—'}${profile.bmi != null ? `, IMC ${profile.bmi}` : ''}.`;
    }
    if (!input.id) return 'Falta o id do registo (vem no health_metric).';
    const id = input.id;

    if (input.action === 'delete') {
      switch (input.kind) {
        case 'intake':
          await services.intakes.remove(userId, id);
          break;
        case 'workout':
          await services.exercise.deleteManual(userId, id);
          break;
        case 'mood':
          await services.wellbeing.removeMood(userId, id);
          break;
        case 'fast':
          await services.wellbeing.removeFast(userId, id);
          break;
        case 'medication':
          await services.records.removeMedication(userId, id);
          break;
        case 'condition':
          await services.records.removeCondition(userId, id);
          break;
        case 'meal':
          await services.nutrition.removeMeal(userId, id);
          break;
        case 'diary':
          await services.records.removeDiaryEntry(userId, id);
          break;
        case 'water':
          await services.water.remove(userId, id);
          break;
        case 'weight':
          await services.weight.remove(userId, id);
          break;
        case 'vital':
          await services.body.removeVital(userId, id);
          break;
      }
      return `Apagado (${input.kind} ${id}).`;
    }

    switch (input.kind) {
      case 'intake': {
        const { entries } = await services.intakes.intakes(userId, 0);
        const entry = entries.find((item) => item.id === id);
        if (!entry) return 'Não encontrei esse registo.';
        const quantityChanged =
          fields.quantity !== undefined && fields.quantity !== entry.quantity;
        const keepTotals = (field: string, value: unknown) =>
          fields[field] !== undefined
            ? fields[field]
            : quantityChanged && (entry.presetId || entry.itemId)
              ? undefined
              : value;
        const updated = await services.intakes.update(
          userId,
          id,
          await checked(SaveIntakeDto, {
            at: fields.at ?? entry.at.toISOString(),
            timeZone: entry.timeZone ?? '+0000',
            presetId: entry.presetId,
            itemId: entry.itemId,
            kind: entry.presetId || entry.itemId ? undefined : entry.kind,
            name: fields.name ?? entry.name,
            quantity: fields.quantity ?? entry.quantity,
            volumeMl: keepTotals('volumeMl', entry.volumeMl),
            caffeineMg: keepTotals('caffeineMg', entry.caffeineMg),
            alcoholG: keepTotals('alcoholG', entry.alcoholG),
            notes: fields.notes ?? entry.notes,
          }),
        );
        return `Alterado: ${updated.quantity}× ${updated.name} a ${updated.day}.`;
      }
      case 'mood': {
        const data = await services.wellbeing.wellbeing(
          userId,
          0,
          lisbonToday(),
        );
        const mood = data.moods.find((item) => item.day === id);
        if (!mood) return 'Não há humor registado nesse dia.';
        await services.wellbeing.saveMood(
          userId,
          id,
          await checked(SaveMoodDto, {
            mood: fields.mood ?? mood.mood,
            energy: fields.energy ?? mood.energy,
            motivation: fields.motivation ?? mood.motivation,
            note: fields.note ?? mood.note,
          }),
        );
        return `Alterado o humor de ${id}.`;
      }
      case 'fast': {
        const data = await services.wellbeing.wellbeing(
          userId,
          0,
          lisbonToday(),
        );
        const fast = data.fasts.find((item) => item.id === id);
        if (!fast) return 'Não encontrei esse jejum.';
        const updated = await services.wellbeing.updateFast(
          userId,
          id,
          await checked(SaveFastDto, {
            startAt: fields.startAt ?? fast.startAt.toISOString(),
            endAt:
              fields.endAt !== undefined
                ? fields.endAt
                : (fast.endAt?.toISOString() ?? null),
            targetHours: fields.targetHours ?? fast.targetHours,
            notes: fields.notes ?? fast.notes,
          }),
        );
        return `Alterado o jejum${updated.hours != null ? ` (${updated.hours} h)` : ''}.`;
      }
      case 'condition': {
        const conditions = await services.records.conditions(userId);
        const condition = conditions.find((item) => item.id === id);
        if (!condition) return 'Não encontrei essa alergia ou doença.';
        const pick = (field: keyof typeof condition) =>
          fields[field] !== undefined ? fields[field] : condition[field];
        const updated = await services.records.updateCondition(
          userId,
          id,
          await checked(SaveHealthConditionDto, {
            kind: pick('kind'),
            name: pick('name'),
            status: pick('status'),
            severity: pick('severity'),
            since: pick('since'),
            resolvedAt: pick('resolvedAt'),
            reaction: pick('reaction'),
            treatment: pick('treatment'),
            notes: pick('notes'),
          }),
        );
        return `Alterado: ${updated.name} (${updated.status}${updated.resolvedAt ? `, tratada a ${updated.resolvedAt}` : ''}).`;
      }
      case 'workout': {
        if (fields.parentId === null) {
          await services.exercise.detachPart(userId, id);
          return 'Treino separado da sessão.';
        }
        if (typeof fields.parentId !== 'string') {
          return 'Nos treinos só se muda a sessão: fields.parentId (o id do principal, ou null para separar) e fields.partRole (WARMUP, COOLDOWN ou PART).';
        }
        const parentId = fields.parentId;
        const main = await services.exercise.workout(userId, parentId);
        const parts = [
          ...main.parts
            .filter((part) => part.id !== id)
            .map((part) => ({ id: part.id, role: part.partRole ?? 'PART' })),
          {
            id,
            role:
              typeof fields.partRole === 'string' ? fields.partRole : 'PART',
          },
        ];
        const updated = await services.exercise.setParts(
          userId,
          parentId,
          await checked(SetWorkoutPartsDto, { parts }),
        );
        return `Sessão de ${updated.typeId}: ${updated.parts.map((part) => `${part.typeId} (${part.partRole})`).join(', ')}.`;
      }
      case 'medication': {
        const medications = await services.records.medications(userId);
        const medication = medications.find((item) => item.id === id);
        if (!medication) return 'Não encontrei esse medicamento.';
        const updated = await services.records.updateMedication(
          userId,
          id,
          await checked(SaveMedicationDto, {
            kind: fields.kind ?? medication.kind,
            name: fields.name ?? medication.name,
            brand: fields.brand !== undefined ? fields.brand : medication.brand,
            substance:
              fields.substance !== undefined
                ? fields.substance
                : medication.substance,
            doseAmount: fields.doseAmount ?? medication.doseAmount,
            doseUnit: fields.doseUnit ?? medication.doseUnit,
            times: fields.times ?? medication.times,
            timesPerDay: fields.timesPerDay ?? medication.timesPerDay,
            startDate: fields.startDate ?? medication.startDate,
            endDate:
              fields.endDate !== undefined
                ? fields.endDate
                : medication.endDate,
            notes: fields.notes ?? medication.notes,
            conditionId:
              fields.conditionId !== undefined
                ? fields.conditionId
                : (medication.condition?.id ?? null),
          }),
        );
        return `Alterado: ${updated.name}${updated.active ? ' (ainda a tomar)' : ` (parou a ${updated.endDate})`}.`;
      }
      case 'vital': {
        const { vitals } = await services.body.body(userId, 0);
        const vital = vitals.find((item) => item.id === id);
        if (!vital) return 'Não encontrei essa medição.';
        const pick = (field: keyof typeof vital) =>
          fields[field] !== undefined ? fields[field] : vital[field];
        // As medições não têm edição no site: grava-se a corrigida e só depois se
        // apaga a antiga, para nunca ficar sem nenhuma se a nova for recusada.
        const updated = await services.body.createVital(
          userId,
          await checked(SaveVitalDto, {
            at:
              fields.at !== undefined
                ? fields.at
                : new Date(vital.at).toISOString(),
            timeZone: vital.timeZone ?? '+0000',
            kind: pick('kind'),
            value: pick('value'),
            value2: pick('value2'),
            pulse: pick('pulse'),
            context: pick('context'),
            notes: pick('notes'),
          }),
        );
        await services.body.removeVital(userId, id);
        return `Alterada a medição (${updated.kind}): ${updated.value}${updated.value2 != null ? `/${updated.value2}` : ''} a ${updated.day}, novo id ${updated.id}.`;
      }
      default:
        return `Para mudar um registo de ${input.kind} apaga-o e regista-o outra vez com o health_log.`;
    }
  } catch (error) {
    const response = (error as { response?: { message?: string | string[] } })
      .response;
    const message: string | string[] =
      response?.message ??
      (error instanceof Error ? error.message : 'erro desconhecido');
    return `Não consegui: ${Array.isArray(message) ? message.join(' ') : message}`;
  }
}
