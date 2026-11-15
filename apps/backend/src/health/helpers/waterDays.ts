import { WaterEntry } from 'src/generated/prisma/client/client';

/** O objetivo diário de água, em ml. */
export const WATER_GOAL_ML = 2000;

export interface WaterDay {
  day: string;
  ml: number;
  entries: { id: string; drankAt: Date; timeZone: string | null; ml: number }[];
}

/** Junta os registos de água por dia (do mais recente para o mais antigo). */
export function waterDays(entries: WaterEntry[]): WaterDay[] {
  const days = new Map<string, WaterDay>();
  for (const entry of entries) {
    const day = entry.day.toISOString().slice(0, 10);
    const current = days.get(day) ?? { day, ml: 0, entries: [] };
    current.ml += entry.ml;
    current.entries.push({
      id: entry.id,
      drankAt: entry.drankAt,
      timeZone: entry.timeZone,
      ml: entry.ml,
    });
    days.set(day, current);
  }
  for (const day of days.values()) {
    day.entries.sort((a, b) => a.drankAt.getTime() - b.drankAt.getTime());
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}
