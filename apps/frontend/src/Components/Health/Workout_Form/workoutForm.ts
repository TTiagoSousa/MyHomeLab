import type { WorkoutSession } from '../../../Hooks/Health/healthTypes';
import { browserTimeZone, dateInput, timeInput } from '../../../Pages/Private/Health/Shared/healthFormat';

export interface SessionForm {
  date: string;
  start: string;
  end: string;
  duration: string;
  calories: string;
  difficulty: number | null;
  notes: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const isBlank = (value: string) => value.trim() === '';

export const wholeNumber = (value: string, min: number, max: number) => {
  const parsed = Number(value);
  return !isBlank(value) && Number.isInteger(parsed) && parsed >= min && parsed <= max;
};

const optionalWhole = (value: string, min: number, max: number) => isBlank(value) || wholeNumber(value, min, max);

const optionalNumber = (value: string) => (isBlank(value) ? undefined : Number(value));

export const sessionFromDates = (start: Date, end: Date | null): SessionForm => ({
  date: dateInput(start),
  start: timeInput(start),
  end: end ? timeInput(end) : '',
  duration: '',
  calories: '',
  difficulty: null,
  notes: '',
});

const startOf = (form: SessionForm) => new Date(`${form.date}T${form.start}`);

const endOf = (form: SessionForm) => {
  if (isBlank(form.end)) return null;
  const start = startOf(form);
  const end = new Date(`${form.date}T${form.end}`);
  return end.getTime() <= start.getTime() ? new Date(end.getTime() + DAY_MS) : end;
};

export const sessionMinutes = (form: SessionForm) => {
  const end = endOf(form);
  if (!end) return null;
  return Math.round((end.getTime() - startOf(form).getTime()) / MINUTE_MS);
};

export const hasSessionLength = (form: SessionForm) => !isBlank(form.end) || !isBlank(form.duration);

export const validSession = (form: SessionForm) => {
  if (Number.isNaN(startOf(form).getTime())) return false;
  const minutes = sessionMinutes(form);
  if (minutes != null && (Number.isNaN(minutes) || minutes < 1 || minutes > 1440)) return false;
  return (minutes != null || optionalWhole(form.duration, 1, 1440)) && optionalWhole(form.calories, 0, 10000);
};

export const sessionPayload = (form: SessionForm): WorkoutSession => {
  const start = startOf(form);
  const end = endOf(form);
  return {
    startAt: start.toISOString(),
    endAt: end ? end.toISOString() : undefined,
    timeZone: browserTimeZone(start),
    durationMin: end ? undefined : optionalNumber(form.duration),
    calories: optionalNumber(form.calories),
    difficulty: form.difficulty ?? undefined,
    notes: form.notes.trim() || undefined,
  };
};
