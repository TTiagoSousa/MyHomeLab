import { AgentScheduleRepeat } from 'src/generated/prisma/client/client';
import {
  nextRunAt as nextScheduleRun,
  parseTime,
} from 'src/agent-schedule/helpers/nextRunAt';

/** Uma vez por dia: o intervalo em que se pode escolher a hora. */
export const DAILY_MINUTES = 1440;

/** A hora só vale todos os dias e com o formato "HH:mm". */
export const cronTime = (intervalMinutes: number, time?: string | null) =>
  intervalMinutes === DAILY_MINUTES && parseTime(time ?? null) ? time! : null;

/**
 * A próxima vez de uma tarefa: todos os dias com hora → a próxima vez a essa hora de
 * Lisboa; senão, daqui a `intervalMinutes` (desligada → nunca).
 */
export function nextRunAt(
  intervalMinutes: number,
  from = new Date(),
  time: string | null = null,
) {
  if (intervalMinutes <= 0) return null;
  const at = cronTime(intervalMinutes, time);
  if (at) {
    return nextScheduleRun(
      {
        repeat: AgentScheduleRepeat.DAILY,
        runAt: null,
        time: at,
        weekday: null,
        monthDay: null,
      },
      from,
    );
  }
  return new Date(from.getTime() + intervalMinutes * 60_000);
}
