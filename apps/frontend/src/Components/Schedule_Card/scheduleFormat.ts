import type { TFunction } from 'i18next';
import type { Schedule, ScheduleRun } from '../../Hooks/Schedules/scheduleTypes';
import { dateLocale } from '../../i18n';

export type ScheduleState = 'on' | 'off' | 'done';

export const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const scheduleWhen = (schedule: Schedule, t: TFunction) => {
  if (schedule.repeat === 'ONCE') {
    return schedule.runAt ? t('schedules:when.once', { date: formatDateTime(schedule.runAt) }) : t('schedules:repeat.ONCE');
  }
  if (schedule.repeat === 'DAILY') return t('schedules:when.daily', { time: schedule.time });
  if (schedule.repeat === 'WEEKLY') {
    return t('schedules:when.weekly', { day: t(`schedules:weekdays.${schedule.weekday ?? 1}`), time: schedule.time });
  }
  return t('schedules:when.monthly', { day: schedule.monthDay, time: schedule.time });
};

export const scheduleState = (schedule: Schedule): ScheduleState => {
  if (schedule.enabled) return 'on';
  return schedule.repeat === 'ONCE' && schedule.runs.length > 0 ? 'done' : 'off';
};

export const runTokens = (run: ScheduleRun) => {
  const total = run.tokensIn + run.tokensOut;
  return total >= 1000 ? `${(total / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })}k` : String(total);
};
