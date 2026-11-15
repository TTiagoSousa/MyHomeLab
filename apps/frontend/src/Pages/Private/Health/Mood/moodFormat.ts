import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import { averageOf } from '../Wellbeing/wellbeingFormat';

export const MOOD_FIELDS = ['mood', 'energy', 'motivation'] as const;
export type MoodField = (typeof MOOD_FIELDS)[number];

export const SCALE = [1, 2, 3, 4, 5];

export const SCALE_FACES: Record<MoodField, string[]> = {
  mood: ['😞', '🙁', '😐', '🙂', '😄'],
  energy: ['🪫', '😴', '🙂', '⚡', '🚀'],
  motivation: ['🛋️', '😕', '😐', '💪', '🔥'],
};

export const MOOD_COLORS: Record<MoodField, string> = {
  mood: '#f59e0b',
  energy: '#10b981',
  motivation: '#8b5cf6',
};

export const moodAverage = (moods: MoodEntry[], field: MoodField) => averageOf(moods.map((entry) => entry[field]));

export interface MoodFilters {
  mood: number;
  withNote: boolean;
  search: string;
}

export const DEFAULT_MOOD_FILTERS: MoodFilters = { mood: 0, withNote: false, search: '' };

export const filterMoods = (moods: MoodEntry[], filters: MoodFilters) => {
  const search = filters.search.trim().toLowerCase();
  return moods.filter(
    (entry) =>
      (!filters.mood || entry.mood === filters.mood) &&
      (!filters.withNote || Boolean(entry.note)) &&
      (!search || (entry.note ?? '').toLowerCase().includes(search)),
  );
};
