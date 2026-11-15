export const now = () => new Date();

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const lisbon = (date: Date) =>
  date.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });

/** A hora (0–23) em Lisboa. */
export const lisbonHour = (date: Date) =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );

/** "AAAA-MM-DD" no dia de Lisboa. */
export const day = (date: Date) =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);
