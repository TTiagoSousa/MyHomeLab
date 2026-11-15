import type { Meal, MealType } from '../../../../Hooks/Health/healthLogTypes';

export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export const NUTRITION_COLORS = {
  kcal: '#f59e0b',
  protein: '#ef4444',
  carbs: '#38bdf8',
  fat: '#a855f7',
};

export const mealTypeForHour = (hour: number): MealType => {
  if (hour < 11) return 'BREAKFAST';
  if (hour < 16) return 'LUNCH';
  if (hour < 19) return 'SNACK';
  return 'DINNER';
};

export const parseDecimal = (value: string) => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : NaN;
};

export const roundOne = (value: number) => Math.round(value * 10) / 10;

export const numberField = (value: number | null | undefined) => (value == null ? '' : String(value));

export const formatKcal = (kcal: number | null | undefined) => (kcal == null ? '—' : `${Math.round(kcal)} kcal`);

export const formatGrams = (grams: number | null | undefined) => (grams == null ? '—' : `${roundOne(grams)} g`);

export const mealsByDay = (meals: Meal[]) => {
  const grouped = new Map<string, Meal[]>();
  for (const meal of meals) {
    const list = grouped.get(meal.day) ?? [];
    list.push(meal);
    grouped.set(meal.day, list);
  }
  return grouped;
};
