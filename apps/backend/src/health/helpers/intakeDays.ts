import { IntakeEntry } from 'src/generated/prisma/client/client';
import { roundTo } from './readings';
import { STANDARD_DRINK_G } from './intakePresets';

export interface IntakeDay {
  day: string;
  caffeineMg: number;
  coffees: number;
  alcoholG: number;
  drinks: number;
}

/**
 * Soma os consumos por dia, do mais recente para o mais antigo: cafeína (e
 * quantos cafés/bebidas com cafeína) e álcool em gramas e em bebidas padrão.
 */
export function intakeDays(
  entries: Pick<
    IntakeEntry,
    'day' | 'kind' | 'name' | 'quantity' | 'caffeineMg' | 'alcoholG'
  >[],
): IntakeDay[] {
  const days = new Map<string, IntakeDay>();
  for (const entry of entries) {
    const key = entry.day.toISOString().slice(0, 10);
    const day = days.get(key) ?? {
      day: key,
      caffeineMg: 0,
      coffees: 0,
      alcoholG: 0,
      drinks: 0,
    };
    days.set(key, day);
    if (entry.kind === 'CAFFEINE') {
      day.caffeineMg += entry.caffeineMg ?? 0;
      day.coffees += entry.quantity;
    }
    if (entry.kind === 'ALCOHOL') day.alcoholG += entry.alcoholG ?? 0;
  }
  return [...days.values()]
    .map((day) => ({
      ...day,
      caffeineMg: Math.round(day.caffeineMg),
      coffees: roundTo(day.coffees, 1),
      alcoholG: roundTo(day.alcoholG, 1),
      drinks: roundTo(day.alcoholG / STANDARD_DRINK_G, 1),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}
