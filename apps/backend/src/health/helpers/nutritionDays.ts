import { IntakeEntry, Meal } from 'src/generated/prisma/client/client';
import { roundTo } from './readings';
import { STANDARD_DRINK_G } from './intakePresets';

export interface NutritionDay {
  day: string;
  meals: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  caffeineMg: number;
  alcoholUnits: number;
}

const empty = (day: string): NutritionDay => ({
  day,
  meals: 0,
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  caffeineMg: 0,
  alcoholUnits: 0,
});

/** Soma as refeições e o que se tomou por dia, do dia mais recente para o mais antigo. */
export function nutritionDays(
  meals: Pick<Meal, 'day' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>[],
  intakes: Pick<IntakeEntry, 'day' | 'kind' | 'caffeineMg' | 'alcoholG'>[],
): NutritionDay[] {
  const days = new Map<string, NutritionDay>();
  const of = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, empty(key));
    return days.get(key)!;
  };

  for (const meal of meals) {
    const day = of(meal.day);
    day.meals += 1;
    day.kcal += meal.kcal ?? 0;
    day.proteinG += meal.proteinG ?? 0;
    day.carbsG += meal.carbsG ?? 0;
    day.fatG += meal.fatG ?? 0;
  }
  for (const intake of intakes) {
    const day = of(intake.day);
    if (intake.kind === 'CAFFEINE') day.caffeineMg += intake.caffeineMg ?? 0;
    if (intake.kind === 'ALCOHOL')
      day.alcoholUnits += (intake.alcoholG ?? 0) / STANDARD_DRINK_G;
  }

  return [...days.values()]
    .map((day) => ({
      ...day,
      proteinG: roundTo(day.proteinG, 1),
      carbsG: roundTo(day.carbsG, 1),
      fatG: roundTo(day.fatG, 1),
      alcoholUnits: roundTo(day.alcoholUnits, 1),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}
