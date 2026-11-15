import { randomBytes } from 'crypto';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  createOpenGymClient,
  OpenGymClient,
  OpenGymRoutine,
  OpenGymSlot,
  OpenGymState,
} from 'src/opengym/opengym.client';
import {
  OpenGymExercise,
  openGymCatalog,
  searchCatalog,
} from 'src/opengym/opengymCatalog';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

const DAYS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : '?';
  } catch {
    return '?';
  }
};

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'openGym'} (${hostOf(account.baseUrl)})`;

/** O openGym a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function openGymTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.OPENGYM)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum openGym ligado. Liga-o em Apps ligadas → openGym.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o openGym: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const clientOf = (account: ConnectedAccount) =>
  createOpenGymClient(account.baseUrl ?? '', account.accessToken ?? '');

const describeError = (error: unknown) =>
  error instanceof AppIntegrationError || error instanceof Error
    ? error.message
    : String(error);

const exerciseLine = (exercise: OpenGymExercise) =>
  `- ${exercise.id} · ${exercise.n}${exercise.pt ? ` (${exercise.pt})` : ''} — ${exercise.bp}, ${exercise.eq}, alvo ${exercise.tg}${exercise.hold ? ', só se segura (usa seconds)' : ''}${exercise.cat && exercise.cat !== 'strength' ? `, ${exercise.cat}` : ''}`;

/** O nome de um exercício de uma rotina (do catálogo ou dos exercícios próprios). */
const nameOf = (
  id: string,
  catalog: Map<string, OpenGymExercise>,
  state: OpenGymState,
) =>
  catalog.get(id)?.pt ??
  catalog.get(id)?.n ??
  state.customEx?.find((custom) => custom.id === id)?.n ??
  id;

const slotLine = (slot: OpenGymSlot, unit: string) =>
  slot.mode === 'cardio'
    ? `${slot.min ?? '?'} min`
    : slot.mode === 'time'
      ? `${slot.sets} × ${slot.sec ?? '?'} s`
      : `${slot.sets} × ${slot.reps ?? '?'}${slot.weight ? ` · ${slot.weight} ${unit}` : ''}${slot.restSec ? ` · descanso ${slot.restSec} s` : ''}`;

const weekOf = (state: OpenGymState) => {
  const week = state.week ?? {};
  return Object.entries(week)
    .map(
      ([day, value]) => [Number(day), [value].flat().filter(Boolean)] as const,
    )
    .filter(([, ids]) => ids.length)
    .sort(([a], [b]) => a - b);
};

/** O resumo: versão, perfil, quantas rotinas e treinos, o último treino e o plano da semana. */
export async function overview(account: ConnectedAccount): Promise<string> {
  try {
    const client = clientOf(account);
    const [me, data] = await Promise.all([client.me(), client.data()]);
    const state = data.state ?? {};
    const routines = state.routines ?? [];
    const workouts = state.workouts ?? [];
    const last = workouts
      .filter((workout) => workout.d)
      .sort((a, b) => (a.d! < b.d! ? 1 : -1))[0];
    const week = weekOf(state)
      .map(
        ([day, ids]) =>
          `${DAYS[day]}: ${ids.map((id) => routines.find((routine) => routine.id === id)?.name ?? id).join(' + ')}`,
      )
      .join('; ');
    return [
      `openGym ${accountLabel(account)} — versão ${account.appVersion ?? '?'}${account.appLatestVersion && account.appLatestVersion !== account.appVersion ? ` (há a ${account.appLatestVersion})` : ''}.`,
      `Perfil: ${me.user.name}${me.user.admin ? ' (admin)' : ''}. Unidade: ${state.unit ?? 'kg'}.`,
      `${routines.length} rotinas: ${routines.map((routine) => routine.name).join(', ') || 'nenhuma'}.`,
      `${workouts.length} treinos registados${last ? `; o último a ${last.d} (${last.name ?? 'sem nome'})` : ''}.`,
      `Plano da semana: ${week || 'nenhum dia marcado'}.`,
    ].join('\n');
  } catch (error) {
    return `O openGym não respondeu: ${describeError(error)}`;
  }
}

/** Procura exercícios no catálogo do openGym (o da versão instalada). */
export async function searchExercises(
  account: ConnectedAccount,
  input: {
    query?: string;
    body_part?: string;
    equipment?: string;
    category?: string;
    limit?: number;
  },
): Promise<string> {
  try {
    const catalog = await openGymCatalog(account.appVersion);
    const found = searchCatalog(catalog, {
      query: input.query,
      bodyPart: input.body_part,
      equipment: input.equipment,
      category: input.category,
      limit: input.limit,
    });
    if (!found.length) {
      return 'Nenhum exercício bate com isso. Tenta palavras em inglês (ex.: "bench press", "squat") ou menos filtros.';
    }
    return [
      `${found.length} exercícios (id · nome — parte do corpo, equipamento, músculo alvo):`,
      ...found.map(exerciseLine),
    ].join('\n');
  } catch (error) {
    return `Não consegui ler o catálogo do openGym: ${describeError(error)}`;
  }
}

/** As rotinas, com os exercícios de cada uma. */
export async function listRoutines(account: ConnectedAccount): Promise<string> {
  try {
    const state = (await clientOf(account).data()).state ?? {};
    const routines = state.routines ?? [];
    if (!routines.length) return 'Não há rotinas no openGym.';
    const exercises: OpenGymExercise[] = await openGymCatalog(
      account.appVersion,
    ).catch(() => []);
    const catalog = new Map(
      exercises.map((exercise) => [exercise.id, exercise] as const),
    );
    const unit = state.unit ?? 'kg';
    return routines
      .map((routine) =>
        [
          `## ${routine.emoji ? `${routine.emoji} ` : ''}${routine.name} (id ${routine.id})`,
          ...(routine.ex ?? []).map(
            (slot) =>
              `- ${nameOf(slot.id, catalog, state)} [${slot.id}]: ${slotLine(slot, unit)}${slot.note ? ` — ${slot.note}` : ''}`,
          ),
        ].join('\n'),
      )
      .join('\n\n');
  } catch (error) {
    return `O openGym não respondeu: ${describeError(error)}`;
  }
}

interface SlotInput {
  id: string;
  sets?: number;
  reps?: number;
  weight?: number;
  rest_sec?: number;
  seconds?: number;
  minutes?: number;
  note?: string;
}

const whole = (value: unknown, min: number, max: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.min(Math.max(number, min), max)
    : undefined;
};

function toSlot(
  input: SlotInput,
  exercise: OpenGymExercise | undefined,
): OpenGymSlot {
  const sets = whole(input.sets, 1, 20) ?? 3;
  const rest = whole(input.rest_sec, 0, 900);
  const note = input.note?.trim().slice(0, 200);
  const extras = {
    ...(rest ? { restSec: rest } : {}),
    ...(note ? { note } : {}),
  };
  if (input.minutes !== undefined || exercise?.cat === 'cardio') {
    return {
      id: input.id,
      sets: 1,
      mode: 'cardio',
      min: whole(input.minutes, 1, 300) ?? 20,
      ...extras,
    };
  }
  if (input.seconds !== undefined || exercise?.hold) {
    return {
      id: input.id,
      sets,
      mode: 'time',
      sec: whole(input.seconds, 5, 3600) ?? 30,
      ...extras,
    };
  }
  const weight = Number(input.weight);
  return {
    id: input.id,
    sets,
    reps: whole(input.reps, 1, 100) ?? 10,
    ...(Number.isFinite(weight) && weight > 0
      ? { weight: Math.round(weight * 4) / 4 }
      : {}),
    ...extras,
  };
}

const parseDays = (days: unknown): number[] =>
  [
    ...new Set(
      (Array.isArray(days) ? days : [])
        .map((day) => Math.round(Number(day)))
        .filter((day) => day >= 0 && day <= 6),
    ),
  ].sort();

/**
 * Lê o estado, aplica a mudança e grava com a revisão lida. Se outro aparelho
 * escreveu entretanto (409), volta a ler e repete uma vez.
 */
async function change(
  client: OpenGymClient,
  apply: (state: OpenGymState) => void,
) {
  for (let attempt = 0; ; attempt++) {
    const data = await client.data();
    const state = structuredClone<OpenGymState>(data.state ?? {});
    apply(state);
    state._ts = Date.now();
    try {
      return await client.saveData(state, data.rev, data.wid);
    } catch (error) {
      const conflict =
        error instanceof AppIntegrationError && /\b409\b/.test(error.message);
      if (!conflict || attempt > 0) throw error;
    }
  }
}

/** Cria uma rotina (nunca apaga nem muda as que lá estão) e, se pedido, marca-a em dias da semana. */
export async function createRoutine(
  account: ConnectedAccount,
  input: {
    name: string;
    emoji?: string;
    exercises: SlotInput[];
    days?: number[];
  },
): Promise<string> {
  const name = input.name?.trim().slice(0, 60);
  if (!name) return 'Falta o nome da rotina.';
  if (!input.exercises?.length)
    return 'A rotina precisa de pelo menos um exercício.';
  try {
    const client = clientOf(account);
    const catalog = new Map(
      (await openGymCatalog(account.appVersion)).map((exercise) => [
        exercise.id,
        exercise,
      ]),
    );
    const current = (await client.data()).state ?? {};
    const custom = new Set((current.customEx ?? []).map((item) => item.id));
    const unknown = input.exercises
      .map((slot) => String(slot.id ?? '').trim())
      .filter((id) => !catalog.has(id) && !custom.has(id));
    if (unknown.length) {
      return `Estes ids não estão no catálogo nem nos exercícios próprios: ${unknown.join(', ')}. Procura-os com opengym_search_exercises.`;
    }
    const routine: OpenGymRoutine = {
      id: randomBytes(6).toString('base64url'),
      name,
      ...(input.emoji?.trim() ? { emoji: input.emoji.trim().slice(0, 4) } : {}),
      ex: input.exercises.map((slot) =>
        toSlot(
          { ...slot, id: String(slot.id).trim() },
          catalog.get(String(slot.id).trim()),
        ),
      ),
    };
    const days = parseDays(input.days);
    await change(client, (state) => {
      state.routines = [...(state.routines ?? []), routine];
      if (days.length) {
        state.week = { ...(state.week ?? {}) };
        for (const day of days) state.week[String(day)] = [routine.id];
      }
    });
    const unit = current.unit ?? 'kg';
    return [
      `Criei a rotina "${name}" (id ${routine.id}) no openGym com ${routine.ex.length} exercícios:`,
      ...routine.ex.map(
        (slot) =>
          `- ${nameOf(slot.id, catalog, current)}: ${slotLine(slot, unit)}`,
      ),
      days.length
        ? `Marcada no plano da semana: ${days.map((day) => DAYS[day]).join(', ')} (substitui o que esses dias tinham).`
        : 'Não a marquei em nenhum dia da semana.',
      'Aparece na app na próxima sincronização (ao abrir ou voltar à app).',
    ].join('\n');
  } catch (error) {
    return `Não consegui gravar no openGym: ${describeError(error)}`;
  }
}

/** Marca rotinas que já existem em dias da semana (0 = domingo … 6 = sábado). */
export async function scheduleWeek(
  account: ConnectedAccount,
  input: { plan: { day: number; routine: string | null }[] },
): Promise<string> {
  const plan = (input.plan ?? []).filter(
    (item) => Number.isInteger(item.day) && item.day >= 0 && item.day <= 6,
  );
  if (!plan.length)
    return 'Diz os dias (0 = domingo … 6 = sábado) e a rotina de cada um.';
  try {
    const client = clientOf(account);
    const routines = ((await client.data()).state ?? {}).routines ?? [];
    const resolve = (wanted: string) =>
      routines.find((routine) => routine.id === wanted) ??
      routines.find((routine) => normalize(routine.name) === normalize(wanted));
    const missing = plan
      .filter((item) => item.routine && !resolve(item.routine))
      .map((item) => item.routine);
    if (missing.length) {
      return `Não encontrei estas rotinas: ${missing.join(', ')}. Vê-as com opengym_list_routines.`;
    }
    await change(client, (state) => {
      state.week = { ...(state.week ?? {}) };
      for (const item of plan) {
        const routine = item.routine ? resolve(item.routine) : null;
        state.week[String(item.day)] = routine ? [routine.id] : [];
      }
    });
    return `Plano da semana gravado: ${plan
      .map(
        (item) =>
          `${DAYS[item.day]} → ${item.routine ? resolve(item.routine)!.name : 'descanso'}`,
      )
      .join('; ')}.`;
  } catch (error) {
    return `Não consegui gravar no openGym: ${describeError(error)}`;
  }
}

/** A rotina pelo id ou pelo nome (sem acentos nem maiúsculas). */
const findRoutine = (routines: OpenGymRoutine[], wanted: string) =>
  routines.find((routine) => routine.id === wanted.trim()) ??
  routines.find((routine) => normalize(routine.name) === normalize(wanted));

/**
 * Muda uma rotina que existe: o nome, o emoji e, com `exercises`, a lista inteira
 * de exercícios (substitui a que lá estava). O resto da rotina fica como estava.
 */
export async function updateRoutine(
  account: ConnectedAccount,
  input: {
    routine: string;
    name?: string;
    emoji?: string;
    exercises?: SlotInput[];
  },
): Promise<string> {
  try {
    const client = clientOf(account);
    const current = (await client.data()).state ?? {};
    const target = findRoutine(current.routines ?? [], input.routine ?? '');
    if (!target) {
      return `Não encontrei a rotina "${input.routine}". Vê-as com opengym_list_routines.`;
    }
    const catalog = new Map(
      (await openGymCatalog(account.appVersion)).map(
        (exercise) => [exercise.id, exercise] as const,
      ),
    );
    const custom = new Set((current.customEx ?? []).map((item) => item.id));
    const slots = input.exercises?.map((slot) => ({
      ...slot,
      id: String(slot.id ?? '').trim(),
    }));
    const unknown = (slots ?? [])
      .map((slot) => slot.id)
      .filter((id) => !catalog.has(id) && !custom.has(id));
    if (unknown.length) {
      return `Estes ids não estão no catálogo nem nos exercícios próprios: ${unknown.join(', ')}. Procura-os com opengym_search_exercises.`;
    }
    if (slots && !slots.length)
      return 'Uma rotina precisa de pelo menos um exercício.';
    const name = input.name?.trim().slice(0, 60);
    const emoji = input.emoji?.trim().slice(0, 4);
    const ex = slots?.map((slot) => toSlot(slot, catalog.get(slot.id)));
    await change(client, (state) => {
      state.routines = (state.routines ?? []).map((routine) =>
        routine.id === target.id
          ? {
              ...routine,
              ...(name ? { name } : {}),
              ...(emoji ? { emoji } : {}),
              ...(ex ? { ex } : {}),
              _ts: Date.now(),
            }
          : routine,
      );
    });
    const unit = current.unit ?? 'kg';
    return [
      `Mudei a rotina "${name ?? target.name}" (id ${target.id}) no openGym.`,
      ...(ex
        ? ex.map(
            (slot) =>
              `- ${nameOf(slot.id, catalog, current)}: ${slotLine(slot, unit)}`,
          )
        : []),
      'Aparece na app na próxima sincronização.',
    ].join('\n');
  } catch (error) {
    return `Não consegui gravar no openGym: ${describeError(error)}`;
  }
}

/**
 * Apaga uma rotina e tira-a dos dias da semana onde estava. Os treinos já feitos com
 * ela ficam (são registos). Só com `confirm: true`, quando ele pediu para a apagar.
 */
export async function deleteRoutine(
  account: ConnectedAccount,
  input: { routine: string; confirm?: boolean },
): Promise<string> {
  try {
    const client = clientOf(account);
    const current = (await client.data()).state ?? {};
    const target = findRoutine(current.routines ?? [], input.routine ?? '');
    if (!target) {
      return `Não encontrei a rotina "${input.routine}". Vê-as com opengym_list_routines.`;
    }
    if (!input.confirm) {
      return `Para apagar "${target.name}" (id ${target.id}) é preciso confirm: true, e só se ele pediu para a apagar.`;
    }
    const days: number[] = [];
    await change(client, (state) => {
      state.routines = (state.routines ?? []).filter(
        (routine) => routine.id !== target.id,
      );
      const week = { ...(state.week ?? {}) };
      for (const [day, value] of Object.entries(week)) {
        const ids = [value].flat().filter(Boolean);
        if (!ids.includes(target.id)) continue;
        week[day] = ids.filter((id) => id !== target.id);
        days.push(Number(day));
      }
      state.week = week;
    });
    return [
      `Apaguei a rotina "${target.name}" do openGym. Os treinos já feitos com ela ficam.`,
      days.length
        ? `Saiu do plano da semana: ${days
            .sort()
            .map((day) => DAYS[day])
            .join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (error) {
    return `Não consegui gravar no openGym: ${describeError(error)}`;
  }
}
