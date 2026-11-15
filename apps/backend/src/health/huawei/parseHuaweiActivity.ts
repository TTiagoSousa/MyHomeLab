import { localDay, localMinute } from '../helpers/timeZone';

/**
 * Um minuto de atividade da pasta "Sport per minute merged data":
 * [instante em ms, passos, distância em m, calorias em cal, fuso "+0100"].
 * Só existem minutos com atividade — contá-los dá os minutos ativos do dia.
 */
export type ActivityMinute = [number, number, number, number, string | null];

export interface HuaweiActivityPayload {
  activity: ActivityMinute[];
}

export interface ParsedActivityDay {
  day: string;
  timeZone: string | null;
  steps: number;
  distanceM: number;
  calories: number;
  activeMinutes: number;
  hourly: number[];
}

const isMinute = (entry: unknown): entry is ActivityMinute =>
  Array.isArray(entry) &&
  typeof entry[0] === 'number' &&
  [entry[1], entry[2], entry[3]].every(
    (value) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0,
  );

/**
 * Soma os minutos por dia local: passos, distância, calorias (em kcal),
 * minutos ativos e os passos de cada hora (para o gráfico do dia).
 */
export function parseHuaweiActivity(
  payload: HuaweiActivityPayload,
): ParsedActivityDay[] {
  const days = new Map<
    string,
    ParsedActivityDay & { minutes: Set<number>; calorieTotal: number }
  >();

  for (const minute of (payload?.activity ?? []).filter(isMinute)) {
    const [time, steps, distance, calories, timeZone] = minute;
    const day = localDay(time, timeZone);
    let entry = days.get(day);
    if (!entry) {
      entry = {
        day,
        timeZone: timeZone ?? null,
        steps: 0,
        distanceM: 0,
        calories: 0,
        activeMinutes: 0,
        hourly: new Array<number>(24).fill(0),
        minutes: new Set(),
        calorieTotal: 0,
      };
      days.set(day, entry);
    }
    entry.steps += steps;
    entry.distanceM += distance;
    entry.calorieTotal += calories;
    entry.hourly[Math.floor(localMinute(time, timeZone) / 60)] += steps;
    entry.minutes.add(Math.floor(time / 60_000));
    entry.timeZone = timeZone ?? entry.timeZone;
  }

  return [...days.values()]
    .map(({ minutes, calorieTotal, ...entry }) => ({
      ...entry,
      distanceM: Math.round(entry.distanceM),
      calories: Math.round(calorieTotal / 1000),
      activeMinutes: minutes.size,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
