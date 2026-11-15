import { localDay } from './timeZone';

/** O dia local de um instante, como Date à meia-noite UTC (para as colunas @db.Date). */
export function localDayDate(at: Date, timeZone: string | null | undefined) {
  return new Date(`${localDay(at, timeZone)}T00:00:00Z`);
}
